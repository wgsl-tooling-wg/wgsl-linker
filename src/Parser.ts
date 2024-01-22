import { Lexer } from "./MatchingLexer.js";
import {
  TraceContext,
  TraceOptions,
  logger,
  parserLog,
  tracing,
  withTraceLogging,
} from "./ParserTracing.js";
import { TokenMatcher } from "./TokenMatcher.js";
import { logErr } from "./TraverseRefs.js";

export interface ParserInit {
  /** supply tokens to the parser*/
  lexer: Lexer;

  /** handy place for user written parsers to accumulate application results */
  app: any[];

  /** handy place for user written parsers to keep or accept context */
  appState: any;

  /** set this to avoid infinite looping by failing after more than this many parsing steps */
  maxParseCount?: number;
}

/* Information passed to the parsers during parsing */
export interface ParserContext extends ParserInit {
  /** during execution, debug trace logging */
  _trace?: TraceContext;

  /** during execution, count parse attempts to avoid infinite looping */
  _parseCount: number;

  _preParse: Parser<unknown>[];

  /** positions where the preparse has failed to match, so no need to retry */
  _preCacheFails: Map<Parser<unknown>, Set<number>>;
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
export interface ParserOld<T> {
  /** start parsing */
  parse(start: ParserInit): OptParserResult<T>;

  /** run the parser given an already created parsing context */
  _run(ctx: ParserContext): OptParserResult<T>;

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

  /** attach a pre-parser to try parsing before this parser runs.
   * (e.g. to recognize comments that can appear almost anywhere in the main grammar) */
  preParse(pre: Parser<unknown>): Parser<T>;

  /** disable a previously attached pre-parser,
   * e.g. to disable a comment preparser in a quoted string parser */
  disablePreParse(pre: Parser<unknown>): Parser<T>;

  /** set which token kinds to ignore while executing this parser and its descendants.
   * If no parameters are provided, no tokens are ignored. */
  tokenIgnore(ignore?: Set<string>): Parser<T>;

  /** use the provided token matcher with this parser and its descendants
   * (i.e. use a temporary lexing mode) */
  tokens(matcher: TokenMatcher): Parser<T>;
}

/** Internal parsing functions return a value and also a set of named results from contained parser  */
type ParseFn<T> = (context: ParserContext) => OptParserResult<T>;

// TODO consider dropping this
/** Create a ParserStage from a function that parses and returns a value */
export function simpleParser<T>(
  fn: (state: ParserContext) => T | null | undefined,
  traceName?: string
): Parser<T> {
  const parserFn: ParseFn<T> = (state: ParserContext) => {
    const r = fn(state);
    if (r !== null && r !== undefined) {
      return { value: r, named: {} };
    } else {
      return null;
    }
  };

  return parser(parserFn, { traceName, terminal: true });
}

/** options for creating a core parser */
export interface ParserArgs {
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

interface ConstructArgs<T> extends ParserArgs {
  fn: ParseFn<T>;
}

/** Create a ParserStage from a full ParseFn function that returns an OptParserResult
 * @param fn the parser function
 * @param args static arguments provided by the user as the parser is constructed
 */
export function parser<T>(fn: ParseFn<T>, args = {} as ParserArgs): Parser<T> {
  return new Parser<T>({ ...args, fn });
}

export class Parser<T> {
  _traceName: string | undefined;
  namedResult: string | undefined;
  traceOptions: TraceOptions | undefined;
  terminal: boolean | undefined;
  fn: ParseFn<T>;

  constructor(args: ConstructArgs<T>) {
    this._traceName = args.traceName;
    this.namedResult = args.resultName;
    this.traceOptions = args.trace;
    this.terminal = args.terminal;
    this.fn = args.fn;
  }

  _cloneWith(p: Partial<ConstructArgs<T>>): Parser<T> {
    return new Parser({
      traceName: this._traceName,
      resultName: this.namedResult,
      trace: this.traceOptions,
      terminal: this.terminal,
      fn: this.fn,
      ...p,
    });
  }

  _run(context: ParserContext): OptParserResult<T> {
    const { lexer, _parseCount = 0, maxParseCount } = context;

    // check for infinite looping
    context._parseCount = _parseCount + 1;
    if (maxParseCount && _parseCount > maxParseCount) {
      logger("infinite loop? ", this.traceName);
      return null;
    }

    // setup trace logging if enabled and active for this parser
    return withTraceLogging()(context, this.traceOptions, (tContext) => {
      const traceSuccessOnly = tContext._trace?.successOnly;
      if (!this.terminal && tracing && !traceSuccessOnly)
        parserLog(`..${this._traceName}`);

      execPreParsers(tContext);

      const position = lexer.position();
      // run the parser function for this stage
      const result = this.fn(tContext);

      if (result === null || result === undefined) {
        // parser failed
        tracing && !traceSuccessOnly && parserLog(`x ${this._traceName}`);
        lexer.position(position); // reset position to orig spot
        return null;
      } else {
        // parser succeded
        tracing && parserLog(`✓ ${this._traceName}`);
        if (this.namedResult) {
          // merge named result (if user set a name for this stage's result)
          return {
            value: result.value,
            named: mergeNamed(result.named, {
              [this.namedResult]: [result.value],
            }),
          };
        }
        // returning orig parser result is fine, no need to name patch
        return result;
      }
    });
  }

  // TODO make name param optional and use the name from a text() or kind() match?
  named(name: string): Parser<T> {
    return this._cloneWith({ resultName: name, traceName: name });
  }
  traceName(name: string): Parser<T> {
    return this._cloneWith({ traceName: name });
  }

  trace(opts: TraceOptions = {}): Parser<T> {
    return this._cloneWith({ trace: opts });
  }

  map<U>(fn: ParserMapFn<T, U>): Parser<U> {
    return map(this, fn);
  }

  toParser<U>(fn: ToParserFn<T, U>): Parser<T | U> {
    return toParser(this, fn);
  }
  parse(start: ParserInit): OptParserResult<T> {
    return this._run({
      ...start,
      _preParse: [],
      _parseCount: 0,
      _preCacheFails: new Map(),
    });
  }

  preParse(pre: Parser<unknown>): Parser<T> {
    return preParse<T>(this, pre);
  }

  disablePreParse(pre: Parser<unknown>): Parser<T> {
    return disablePreParse<T>(this, pre);
  }

  tokenIgnore(ignore?: Set<string>): Parser<T> {
    return tokenIgnore<T>(this, ignore);
  }

  tokens(matcher: TokenMatcher): Parser<T> {
    return tokens<T>(this, matcher);
  }
}

function execPreParsers(ctx: ParserContext): void {
  const { _preParse, _preCacheFails, lexer } = ctx;

  const ctxNoPre = { ...ctx, _preParse: [] };
  _preParse.forEach((pre) => {
    // get the cache of failed positions for this pre-parser
    const failCache = _preCacheFails.get(pre) || new Set();
    _preCacheFails.set(pre, failCache);

    // exec each pre-parser until it fails
    let position: number;
    let preResult: OptParserResult<unknown>;
    do {
      position = lexer.position();
      if (failCache.has(position)) break;

      preResult = pre._run(ctxNoPre);
    } while (preResult !== null && preResult !== undefined);

    failCache.add(position);
    lexer.position(position); // reset position to end of last successful parse
  });
}

type ParserMapFn<T, U> = (results: ExtendedResult<T>) => U | null;

/** return a parser that maps the current results */
function map<T, U>(parseFn: Parser<T>, fn: ParserMapFn<T, U>): Parser<U> {
  return parser(
    (ctx: ParserContext): OptParserResult<U> => {
      const extended = runExtended(ctx, parseFn);
      if (!extended) return null;

      const mappedValue = fn(extended);
      if (mappedValue === null) return null;

      return { value: mappedValue, named: extended.named };
    },
    { traceName: "map" }
  );
}

type ToParserFn<T, N> = (results: ExtendedResult<T>) => Parser<N> | undefined;

function toParser<T, N>(
  parseFn: Parser<T>,
  fn: ToParserFn<T, N>
): Parser<T | N> {
  return parser(
    (ctx: ParserContext): OptParserResult<T | N> => {
      const extended = runExtended(ctx, parseFn);
      if (!extended) return null;

      // run the supplied function to get a parser
      const p = fn(extended);

      if (p === undefined) {
        return extended;
      }

      // run the parser returned by the supplied function
      const nextResult = p._run(ctx);
      return nextResult;
    },
    { traceName: "toParser" }
  );
}

function tokenIgnore<T>(
  mainParser: Parser<T>,
  ignore: Set<string> = new Set()
): Parser<T> {
  return parser(
    (ctx: ParserContext): OptParserResult<T> =>
      ctx.lexer.withIgnore(ignore, () => mainParser._run(ctx)),
    { traceName: "tokenIgnore" }
  );
}

function preParse<T>(mainParser: Parser<T>, pre: Parser<unknown>): Parser<T> {
  return parser(
    (ctx: ParserContext): OptParserResult<T> => {
      const newCtx = { ...ctx, _preParse: [pre, ...ctx._preParse] };
      return mainParser._run(newCtx);
    },
    { traceName: "preParse" }
  );
}

/** run a parser with a provided token matcher (i.e. use a temporary lexing mode) */
function tokens<T>(mainParser: Parser<T>, matcher: TokenMatcher): Parser<T> {
  return parser(
    (state: ParserContext): OptParserResult<T> => {
      return state.lexer.withMatcher(matcher, () => {
        return mainParser._run(state);
      });
    },
    { traceName: `tokens ${matcher._traceName}` }
  );
}

function disablePreParse<T>(
  mainParser: Parser<T>,
  pre: Parser<unknown>
): Parser<T> {
  return parser(
    (ctx: ParserContext): OptParserResult<T> => {
      const preps = ctx._preParse;
      const foundDex = preps.findIndex((p) => p === pre);
      if (foundDex < 0) {
        logErr("disablePreParse: pre parser to disable not found");
      }
      const newPreparse = [
        ...preps.slice(0, foundDex),
        ...preps.slice(foundDex + 1),
      ];
      const newCtx = { ...ctx, _preParse: newPreparse };
      return mainParser._run(newCtx);
    },
    { traceName: "disablePreParse" }
  );
}

/** run parser, return extended results to support map() or toParser() */
function runExtended<T>(
  ctx: ParserContext,
  parseFn: Parser<T>
): ExtendedResult<T> | null {
  const start = ctx.lexer.position();
  const origResults = parseFn._run(ctx);
  if (origResults === null) return null;
  const end = ctx.lexer.position();
  const { app, appState } = ctx;
  const extended = { ...origResults, start, end, app, appState };
  return extended;
}

/** merge arrays in liked named keys */
export function mergeNamed(
  a: Record<string, any[]>,
  b: Record<string, any[]>
): Record<string, any[]> {
  const sharedKeys = Object.keys(a).filter((k) => b[k]);
  // combine arrays from liked named keys
  const sharedEntries = sharedKeys.map((k) => [k, [...a[k], ...b[k]]]);
  const shared = Object.fromEntries(sharedEntries);
  return { ...a, ...b, ...shared }; // shared keys overwritten
}