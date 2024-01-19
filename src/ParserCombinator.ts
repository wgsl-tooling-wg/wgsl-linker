import { Lexer } from "./MatchingLexer.js";
import {
  TraceContext,
  TraceOptions,
  logger,
  parserLog,
  tracing,
  withTraceLogging,
} from "./ParserTracing.js";
import { Token, TokenMatcher } from "./TokenMatcher.js";

/** Parsing Combinators
 *
 * The basic idea is that parsers are contructed heirarchically from other parsers.
 * Each parser is independently testable and reusable with combinators like or() and seq().
 *
 * Each parser is a function that recognizes tokens produced by a lexer
 * and returns a result.
 *  Returning null indicate failure. Tokens are not consumed on failure.
 *  Users can also use the .named() method to tag results from a stage. Named results
 *    propagate up to containing parsers for convenience in selecting results.
 *
 * Built in parsers and combinators are available:
 *  kind() recognizes tokens of a particular type.
 *  or(), seq(), opt(), map() and repeat() combine other stages.
 *
 * Users construct their own parsers by combining other parser stages
 * and typically use map() to report results. Results can be stored
 * in the array app[], which is provided by the user and available for
 * all user constructed parsers.
 */

/** Information passed to the parsers during parsing */
export interface ParserContext {
  /** supply tokens to the parser*/
  lexer: Lexer;

  /** handy place for user written parsers to accumulate application results */
  app: any[];

  /** handy place for user written parsers to keep or accept context */
  appState: any;

  /** during execution, debug trace logging */
  _trace?: TraceContext;

  /** during execution, count parse attempts to avoid infinite looping */
  _parseCount?: number;
  
  /** avoid infinite looping but not attempting to parse more than this many times */
  maxParseCount?: number;
}

/** Result from a parser */
export interface ParserResult<T> {
  /** result from this stage */
  value: T;

  /** named results from this stage and all child stages*/
  named: Record<string, any[]>;
}

export interface ExtendedResult<T> extends ParserResult<T> {
  start: number;
  end: number;
  app: any[];
  appState: any;
}

/** parsers return null if they don't match */
export type OptParserResult<T> = ParserResult<T> | null;

/** a composable parsing element */
export interface Parser<T> {
  (state: ParserContext): OptParserResult<T>;
  /**
   * tag results with a name,
   *
   * named results can be retrived with map(r => r.named.myName)
   * note that named results are collected into an array,
   * multiple matches with the same name (even from different nested parsers) accumulate
   */
  named(name: string): Parser<T>;

  /** record a name for debug tracing */
  traceName(name: string): Parser<T>;

  /** map results to a new value, or add to app state as a side effect */
  map<U>(fn: (result: ExtendedResult<T>) => U | null): Parser<U>;

  /** switch next parser based on results */
  toParser<N>(
    fn: (result: ExtendedResult<T>) => Parser<N> | undefined
  ): Parser<T | N>;

  /** trigger tracing for this parser (and by default also this parsers descendants) */
  trace(opts?: TraceOptions): Parser<T>;
}

/** Internal parsing functions return a value and also a set of named results from contained parser  */
type StageFn<T> = (state: ParserContext) => OptParserResult<T>;

/** parser combinators like or() and seq() combine other stages (strings are converted to kind() parsers) */
export type ParserStageArg<T> = Parser<T> | string;

// TODO consider dropping this
/** Create a ParserStage from a function that parses and returns a value */
export function parsing<T>(
  fn: (state: ParserContext) => T | null | undefined,
  traceName?: string
): Parser<T> {
  const parserFn: StageFn<T> = (state: ParserContext) => {
    const r = fn(state);
    if (r !== null && r !== undefined) {
      return { value: r, named: {} };
    } else {
      return null;
    }
  };

  return parserStage(parserFn, { traceName, terminal: true });
}

interface ParserArgs {
  /** name to use for result in named results */
  resultName?: string;

  /** name to use for trace logging */
  traceName?: string;

  /** enable trace logging */
  trace?: TraceOptions;

  /** true for elements without children like kind(), and text(), 
   * (to avoid intro log statement while tracing) */
  terminal?: boolean;
}

/** Create a ParserStage from a full StageFn function that returns an OptParserResult */
export function parserStage<T>(
  fn: StageFn<T>,
  args = {} as ParserArgs
): Parser<T> {
  const { traceName, resultName, trace, terminal } = args;
  const stageFn = (state: ParserContext): OptParserResult<T> => {
    const { lexer, _parseCount = 0, maxParseCount } = state;
    state._parseCount = _parseCount + 1;
    if (maxParseCount && _parseCount > maxParseCount) {
      logger("infinite loop? ", traceName);
      return null;
    }
    const position = lexer.position();

    return withTraceLogging()(state, trace, (tstate) => {
      if (!terminal && tracing) parserLog(`..${traceName}`);
      const result = fn(tstate);

      if (result === null || result === undefined) {
        tracing && parserLog(`x ${traceName}`);
        lexer.position(position);
        return null;
      } else {
        tracing && parserLog(`✓ ${traceName}`);
        if (resultName) {
          return {
            value: result.value,
            named: mergeNamed(result.named, { [resultName]: [result.value] }),
          };
        }
        return result;
      }
    });
  };

  // TODO make name param optional and use the name from a text() or kind() match?
  stageFn.named = (name: string) =>
    parserStage(fn, { ...args, resultName: name, traceName: name });
  stageFn.traceName = (name: string) =>
    parserStage(fn, { ...args, traceName: name });
  stageFn.map = map;
  stageFn.toParser = toParser;
  stageFn.trace = (opts: TraceOptions = {}) =>
    parserStage(fn, { ...args, trace: opts });

  function map<U>(
    fn: (results: ExtendedResult<T>) => U | null
  ): Parser<U> {
    return parserStage(
      (ctx: ParserContext): OptParserResult<U> => {
        const extended = runInternal(ctx);
        if (!extended) return null;

        const mappedValue = fn(extended);
        if (mappedValue === null) return null;

        return { value: mappedValue, named: extended.named };
      },
      { traceName: "map" }
    );
  }

  function toParser<N>(
    fn: (results: ExtendedResult<T>) => Parser<N> | undefined
  ): Parser<T | N> {
    return parserStage(
      (ctx: ParserContext): OptParserResult<T | N> => {
        const extended = runInternal(ctx);
        if (!extended) return null;

        // run the supplied function to get a parser
        const p = fn(extended);

        if (p === undefined) {
          return extended;
        }

        // run the parser returned by the supplied function
        const nextResult = p(ctx);
        return nextResult;
      },
      { traceName: "toParser" }
    );
  }

  /** run local parser, return extended results */
  function runInternal(ctx: ParserContext): ExtendedResult<T> | null {
    const start = ctx.lexer.position();
    const origResults = stageFn(ctx);
    if (origResults === null) return null;
    const end = ctx.lexer.position();
    const { app, appState } = ctx;
    const extended = { ...origResults, start, end, app, appState };
    return extended;
  }

  return stageFn;
}

/** Parse for a particular kind of token,
 * @return the matching text */
export function kind(kindStr: string): Parser<string> {
  return parsing((state: ParserContext): string | null => {
    const next = state.lexer.next();
    return next?.kind === kindStr ? next.text : null;
  }, `kind '${kindStr}'`);
}

/** Parse for a token containing a text value
 * @return the kind of token that matched */
export function text(value: string): Parser<string> {
  return parsing((state: ParserContext): string | null => {
    const next = state.lexer.next();
    return next?.text === value ? next.text : null;
  }, `text '${value}'`);
}

/** Try parsing with one or more parsers,
 *  @return the first successful parse */
export function or<T = Token>(a: ParserStageArg<T>): Parser<T>;
export function or<T = Token, U = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>
): Parser<T | U>;
export function or<T = Token, U = Token, V = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>
): Parser<T | U | V>;
export function or<T = Token, U = Token, V = Token, W = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>
): Parser<T | U | V | W>;
export function or<T = Token, U = Token, V = Token, W = Token, X = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>,
  e: ParserStageArg<X>
): Parser<T | U | V | W | X>;
export function or<
  T = Token,
  U = Token,
  V = Token,
  W = Token,
  X = Token,
  Y = Token
>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>,
  e: ParserStageArg<X>,
  f: ParserStageArg<Y>
): Parser<T | U | V | W | X | Y>;
export function or(...stages: ParserStageArg<any>[]): Parser<any> {
  return parserStage(
    (state: ParserContext): ParserResult<any> | null => {
      for (const stage of stages) {
        const parser = parserArg(stage);
        const result = parser(state);
        if (result !== null) {
          return result;
        }
      }
      return null;
    },
    { traceName: "or" }
  );
}

/** Parse a sequence of parsers
 * @return an array of all parsed results, or null if any parser fails */
export function seq<T = Token, U = Token>(
  a: ParserStageArg<T>
): Parser<[T]>;
export function seq<T = Token, U = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>
): Parser<[T, U]>;
export function seq<T = Token, U = Token, V = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>
): Parser<[T, U, V]>;
export function seq<T = Token, U = Token, V = Token, W = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>
): Parser<[T, U, V, W]>;
export function seq<T = Token, U = Token, V = Token, W = Token, X = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>,
  e: ParserStageArg<X>
): Parser<[T, U, V, W, X]>;
export function seq<
  T = Token,
  U = Token,
  V = Token,
  W = Token,
  X = Token,
  Y = Token
>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>,
  e: ParserStageArg<X>,
  f: ParserStageArg<Y>
): Parser<[T, U, V, W, X, Y]>;
export function seq(...stages: ParserStageArg<any>[]): Parser<any[]>;
export function seq(...stages: ParserStageArg<any>[]): Parser<any[]> {
  return parserStage(
    (state: ParserContext) => {
      const values = [];
      let namedResults = {};
      for (const stage of stages) {
        const parser = parserArg(stage);
        const result = parser(state);
        if (result === null) return null;

        namedResults = mergeNamed(namedResults, result.named);
        values.push(result.value);
      }
      return { value: values, named: namedResults };
    },
    { traceName: "seq" }
  );
}

/** Try a parser.
 *
 * If the parse succeeds, return the result.
 * If the parser fails, return false and don't advance the input. Returning false
 * indicates a successful parse, so combinators like seq() will succeed.
 */
export function opt<T>(stage: string): Parser<string | boolean>;
export function opt<T>(stage: Parser<T>): Parser<T | boolean>;
export function opt<T>(
  stage: ParserStageArg<T>
): Parser<T | string | boolean> {
  return parserStage(
    (state: ParserContext): OptParserResult<T | string | boolean> => {
      const parser = parserArg(stage);
      const result = parser(state);
      return result || { value: false, named: {} };
    },
    { traceName: "opt" }
  );
}

/** return true if the provided parser _doesn't_ match
 * does not consume any tokens
 * */
export function not<T>(stage: ParserStageArg<T>): Parser<true> {
  return parserStage(
    (state: ParserContext): OptParserResult<true> => {
      const pos = state.lexer.position();
      const result = parserArg(stage)(state);
      if (!result) {
        return { value: true, named: {} };
      }
      state.lexer.position(pos);
      return null;
    },
    { traceName: "not" }
  );
}

/** yield next token, any token */
export function any(): Parser<Token> {
  return parsing((state: ParserContext): Token | null => {
    const next = state.lexer.next();
    return next || null;
  }, "any");
}

export function repeat(stage: string): Parser<string[]>;
export function repeat<T>(stage: Parser<T>): Parser<T[]>;
export function repeat<T>(
  stage: ParserStageArg<T>
): Parser<(T | string)[]> {
  return parserStage(
    (state: ParserContext): OptParserResult<(T | string)[]> => {
      const values: (T | string)[] = [];
      let results = {};
      while (true) {
        const parser = parserArg(stage);
        const result = parser(state);
        if (result !== null) {
          values.push(result.value);
          results = mergeNamed(results, result.named);
        } else {
          return { value: values, named: results };
        }
      }
    },
    { traceName: "repeat" }
  );
}

/** run a parser with a provided token matcher (i.e. use a temporary lexing mode) */
export function tokens<T>(
  matcher: TokenMatcher,
  arg: Parser<T>
): Parser<T>;
export function tokens<T>(
  matcher: TokenMatcher,
  arg: ParserStageArg<T>
): Parser<T | string> {
  return parserStage(
    (state: ParserContext): OptParserResult<T | string> => {
      return state.lexer.withMatcher(matcher, () => {
        const p = parserArg(arg);
        return p(state);
      });
    },
    { traceName: `tokens ${matcher._traceName}` }
  );
}

/** A delayed parser definition, for making recursive parser definitions. */
export function fn<T>(fn: () => Parser<T>): Parser<T | string> {
  return parserStage((state: ParserContext): OptParserResult<T | string> => {
    const stage = parserArg(fn());
    return stage(state);
  });
}

/** yields true if parsing has reached the end of input */
export function eof(): Parser<true> {
  return parsing((state: ParserContext) => state.lexer.eof() || null, "eof");
}

/** convert naked string arguments into text() parsers */
export function parserArg<T>(
  arg: ParserStageArg<T>
): Parser<T> | Parser<string> {
  return typeof arg === "string" ? text(arg) : arg;
}

/** merge arrays in liked named keys */
function mergeNamed(
  a: Record<string, any[]>,
  b: Record<string, any[]>
): Record<string, any[]> {
  const sharedKeys = Object.keys(a).filter((k) => b[k]);
  // combine arrays from liked named keys
  const sharedEntries = sharedKeys.map((k) => [k, [...a[k], ...b[k]]]);
  const shared = Object.fromEntries(sharedEntries);
  return { ...a, ...b, ...shared }; // shared keys overwritten
}
