import { Lexer } from "./MatchingLexer.js";
import { Token, TokenMatcher } from "./TokenMatcher.js";

let parserLog = console.log; // exposed for testing

export function _withParserLog<T>(logFn: typeof console.log, fn: () => T): T {
  const orig = parserLog;
  try {
    parserLog = logFn;
    return fn();
  } finally {
    parserLog = orig;
  }
}

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
 *  or(), seq(), opt(), map(), and repeat() combine other stages.
 *
 * Users construct their own parsers by combining other parser stages
 * and typically use mapResults() to report results. Results can be stored
 * in the array app[], which is provided by the user and available for
 * all user constructed parsers.
 */

/** Information passed to the parsers during parsing */
export interface ParserContext {
  /** supply tokens to the parser*/
  lexer: Lexer;

  /** handy place for user written parsers to accumulate application results */
  app: any[];

  /** during execution, debug trace logging */
  _debug?: DebugContext;
}

interface DebugContext {
  indent: number;
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
  results: any[];
}

/** parsers return null if they don't match */
export type OptParserResult<T> = ParserResult<T> | null;

/** a composable parsing element */
export interface ParserStage<T> {
  (state: ParserContext): OptParserResult<T>;
  named(name: string): ParserStage<T>;
  traceName(name: string): ParserStage<T>;
  map<U>(fn: (result: T) => U | null): ParserStage<U | true>;
  mapResults<U>(
    fn: (result: ExtendedResult<T>) => U | null
  ): ParserStage<U | true>;
  parserName?: string;
  trace(deep?: boolean): ParserStage<T>;
}

/** Internal parsing functions return a value and also a set of named results from contained parser  */
type StageFn<T> = (state: ParserContext) => OptParserResult<T>;

/** parser combinators like or() and seq() combine other stages (strings are converted to kind() parsers) */
type ParserStageArg<T> = ParserStage<T> | string;

// TODO consider dropping this
/** Create a ParserStage from a function that parses and returns a value */
export function parsing<T>(
  fn: (state: ParserContext) => T | null | undefined,
  traceName?: string
): ParserStage<T> {
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
  resultName?: string; // name to use for result in named results
  traceName?: string; // name to use for trace logging
  trace?: TraceType; // enable trace logging
  terminal?: boolean; // true for kind(), and text(), to avoid intro log statement
}

type TraceType = true | "deep" | "surround" | undefined;

/** Create a ParserStage from a full StageFn function that returns an OptParserResult */
export function parserStage<T>(
  fn: StageFn<T>,
  args = {} as ParserArgs
): ParserStage<T> {
  const { traceName, resultName, trace, terminal } = args;
  const stageFn = (state: ParserContext): OptParserResult<T> => {
    const { lexer } = state;
    const position = lexer.position();

    // setup trace logging
    const { tlog, tstate } = traceLogging(state, trace);

    if (!terminal) tlog(`..${traceName}`);
    const result = fn(tstate);

    if (result === null || result === undefined) {
      tlog(`x ${traceName}`);
      lexer.position(position);
      return null;
    } else {
      tlog(`✓ ${traceName}`);
      if (resultName) {
        return {
          value: result.value,
          named: mergeNamed(result.named, { [resultName]: [result.value] }),
        };
      }
      return result;
    }
  };

  // TODO make name param optional and use the name from a text() or kind() match?
  stageFn.named = (name: string) =>
    parserStage(fn, { ...args, resultName: name });
  stageFn.traceName = (name: string) =>
    parserStage(fn, { ...args, traceName: name });
  stageFn.mapResults = mapResults;
  stageFn.trace = (deep = true) =>
    parserStage(fn, { ...args, trace: deep ? "deep" : true });

  stageFn.map = <U>(fn: (result: T) => U | null) =>
    mapResults((results) => fn(results.value));

  function mapResults<U>(
    fn: (results: ExtendedResult<T>) => U | null
  ): ParserStage<U | true> {
    return parserStage((state: ParserContext): OptParserResult<U | true> => {
      const start = state.lexer.position();
      const origResults = stageFn(state);
      if (origResults === null) return null;
      const end = state.lexer.position();
      const extended = { ...origResults, start, end, results: state.app };
      const mappedValue = fn(extended);
      if (mappedValue === null) return null;
      const value = mappedValue === undefined ? true : mappedValue;

      return { value, named: origResults.named };
    });
  }

  return stageFn;
}

/** Parse for a particular kind of token,
 * @return the matching text */
export function kind(kindStr: string): ParserStage<string> {
  return parsing((state: ParserContext): string | null => {
    const next = state.lexer.next();
    return next?.kind === kindStr ? next.text : null;
  }, `kind '${kindStr}'`);
}

/** Parse for a token containing a text value
 * @return the kind of token that matched */
export function text(value: string): ParserStage<string> {
  return parsing((state: ParserContext): string | null => {
    const next = state.lexer.next();
    return next?.text === value ? next.kind : null;
  }, `text '${value}'`);
}

/** Try parsing with one or more parsers,
 *  @return the first successful parse */
export function or<T = Token>(a: ParserStageArg<T>): ParserStage<T>;
export function or<T = Token, U = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>
): ParserStage<T | U>;
export function or<T = Token, U = Token, V = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>
): ParserStage<T | U | V>;
export function or<T = Token, U = Token, V = Token, W = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>
): ParserStage<T | U | V | W>;
export function or<T = Token, U = Token, V = Token, W = Token, X = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>,
  e: ParserStageArg<X>
): ParserStage<T | U | V | W | X>;
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
): ParserStage<T | U | V | W | X | Y>;
export function or(...stages: ParserStageArg<any>[]): ParserStage<any> {
  return parserStage(
    (state: ParserContext): ParserResult<any> | null => {
      const localState = traceIndent(state);
      for (const stage of stages) {
        const parser = parserArg(stage);
        const result = parser(localState);
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
): ParserStage<[T]>;
export function seq<T = Token, U = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>
): ParserStage<[T, U]>;
export function seq<T = Token, U = Token, V = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>
): ParserStage<[T, U, V]>;
export function seq<T = Token, U = Token, V = Token, W = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>
): ParserStage<[T, U, V, W]>;
export function seq<T = Token, U = Token, V = Token, W = Token, X = Token>(
  a: ParserStageArg<T>,
  b: ParserStageArg<U>,
  c: ParserStageArg<V>,
  d: ParserStageArg<W>,
  e: ParserStageArg<X>
): ParserStage<[T, U, V, W, X]>;
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
): ParserStage<[T, U, V, W, X, Y]>;
export function seq(...stages: ParserStageArg<any>[]): ParserStage<any[]> {
  return parserStage(
    (state: ParserContext) => {
      const localState = traceIndent(state);
      const values = [];
      let namedResults = {};
      for (const stage of stages) {
        const parser = parserArg(stage);
        const result = parser(localState);
        if (result === null) return null;

        namedResults = mergeNamed(namedResults, result.named);
        values.push(result.value);
      }
      return { value: values, named: namedResults };
    },
    { traceName: "seq" }
  );
}

/** increase indent for debug trace logging, if tracing is active */
function traceIndent(state: ParserContext): ParserContext {
  let _debug = state._debug;
  if (_debug) {
    _debug = { indent: _debug.indent + 1 };
  }
  return { ...state, _debug };
}

/** Try a parser.
 *
 * If the parse succeeds, return the result.
 * If the parser fails, return false and don't advance the input. Returning false
 * indicates a successful parse, so combinators like seq() will succeed.
 */
export function opt<T>(stage: string): ParserStage<string | boolean>;
export function opt<T>(stage: ParserStage<T>): ParserStage<T | boolean>;
export function opt<T>(
  stage: ParserStageArg<T>
): ParserStage<T | string | boolean> {
  return parserStage(
    (state: ParserContext): OptParserResult<T | string | boolean> => {
      const parser = parserArg(stage);
      const result = parser(state);
      return result || { value: false, named: {} };
    },
    { traceName: "opt" }
  );
}

/** yield one token, unless it matches the provided parser */ // TODO shouldn't consume match..
export function not<T>(stage: ParserStageArg<T>): ParserStage<Token | true> {
  return parserStage(
    (state: ParserContext): OptParserResult<Token | true> => {
      const localState = traceIndent(state);
      const result = parserArg(stage)(localState);
      if (result) {
        return null;
      } else {
        const next = state.lexer.next();
        return next ? { value: next, named: {} } : null;
      }
    },
    { traceName: "not" }
  );
}

/** yield next token, any token */
export function any(): ParserStage<Token> {
  return parsing((state: ParserContext): Token | null => {
    const next = state.lexer.next();
    return next || null;
  }, "any");
}

export function repeat(stage: string): ParserStage<string[]>;
export function repeat<T>(stage: ParserStage<T>): ParserStage<T[]>;
export function repeat<T>(
  stage: ParserStageArg<T>
): ParserStage<(T | string)[]> {
  return parserStage(
    (state: ParserContext): OptParserResult<(T | string)[]> => {
      const localState = traceIndent(state);
      const values: (T | string)[] = [];
      let results = {};
      while (true) {
        const parser = parserArg(stage);
        const result = parser(localState);
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
  arg: ParserStageArg<T>
): ParserStage<T | string> {
  return parserStage(
    (state: ParserContext): OptParserResult<T | string> => {
      return state.lexer.withMatcher(matcher, () => {
        const parser = parserArg(arg);
        return parser(state);
      });
    },
    { traceName: "tokens" }
  );
}

/** A delayed parser definition, for making recursive parser definitions. */
export function fn<T>(fn: () => ParserStage<T>): ParserStage<T | string> {
  return parserStage((state: ParserContext): OptParserResult<T | string> => {
    const stage = parserArg(fn());
    return stage(state);
  });
}

/** yields true if parsing has reached the end of input */
export function eof(): ParserStage<true> {
  return parsing((state: ParserContext) => state.lexer.eof() || null, "eof");
}

/** convert naked string arguments into kind() parsers */ // LATEr consider converting to text() parser instead
function parserArg<T>(
  arg: ParserStageArg<T>
): ParserStage<T> | ParserStage<string> {
  return typeof arg === "string" ? kind(arg) : arg;
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

function currentIndent(debug?: DebugContext) {
  return "  ".repeat(debug?.indent || 0);
}

interface TraceLogging {
  tlog(...msgs: any[]): void;
  tstate: ParserContext;
}

/** setup trace logging inside a parser stage */
function traceLogging(state: ParserContext, trace: TraceType): TraceLogging {
  let { _debug } = state;
  if (!trace && !_debug) {
    return { tlog: () => {}, tstate: state };
  }
  if (!_debug && trace === "deep") {
    _debug = { indent: 0 };
  }
  const pad = currentIndent(_debug);
  function tlog(...msgs: any[]) {
    parserLog(`${pad}${msgs[0]}`, ...msgs.slice(1));
  }
  const tstate = { ...state, _debug };
  return { tlog, tstate };
}
