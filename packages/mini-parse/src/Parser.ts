import { CombinatorArg, ParserFromArg } from "./CombinatorTypes.js";
import { Lexer } from "./MatchingLexer.js";
import { ParseError, parserArg } from "./ParserCombinator.js";
import { srcLog } from "./ParserLogging.js";
import {
  parserLog,
  TraceContext,
  TraceOptions,
  tracing,
  withTraceLogging,
} from "./ParserTracing.js";
import { mergeTags } from "./ParserUtil.js";
import { SrcMap } from "./SrcMap.js";

export interface AppState<A> {
  /**
   * Context for user written parsers while parsing. e.g. for nested #if state
   * The context value is reset to its original value if the parser fails.
   * Set context to a new immutable value to update (don't internally mutate context)
   */
  context: A;

  /** typical place for user written parsers to accumulate results, e.g. syntax tree */
  state: any;
}

export interface ParserInit<A = any> {
  /** supply tokens to the parser*/
  lexer: Lexer;

  /** application specific context and result storage, shared with every parser */
  app?: AppState<A>;

  /** set this to avoid infinite looping by failing after more than this many parsing steps */
  maxParseCount?: number;

  /** if this text was preprocessed */
  srcMap?: SrcMap;
}

/* Information passed to the parsers during parsing */
export interface ParserContext<A = any> {
  lexer: Lexer;

  app: AppState<A>;

  maxParseCount?: number;

  /** during execution, debug trace logging */
  _trace?: TraceContext;

  /** during execution, count parse attempts to avoid infinite looping */
  _parseCount: number;

  _preParse: Parser<unknown>[];

  /** positions where the preparse has failed to match, so no need to retry */
  _preCacheFails: Map<Parser<unknown>, Set<number>>;

  srcMap?: SrcMap;

  _debugNames: string[];
}

export type TagRecord = Record<string | symbol, any[] | undefined>;
export type NoTags = Record<string | symbol, never>;

/** Result from a parser */
export interface ParserResult<T, N extends TagRecord> {
  /** result from this stage */
  value: T;

  /** tagged results from this stage and all child stages*/
  tags: N;
}

export interface ExtendedResult<T, N extends TagRecord = NoTags, A = any>
  extends ParserResult<T, N> {
  src: string;
  srcMap?: SrcMap;
  start: number;
  end: number;
  app: AppState<A>;
  ctx: ParserContext<A>;
}

/** parsers return null if they don't match */
// prettier-ignore
export type OptParserResult<T, N extends TagRecord> = 
    ParserResult<T, N> 
  | null;

/** Internal parsing functions return a value and also a set of tagged results from contained parser  */
type ParseFn<T, N extends TagRecord> = (
  context: ParserContext,
) => OptParserResult<T, N>;

/** options for creating a core parser */
export interface ParserArgs {
  /** name to use for result in tagged results */
  tag?: string | symbol;

  /** name to use for trace logging */
  traceName?: string;

  /** use the debugName from this source parser for trace logging */
  traceSrc?: Parser<any, any>;

  /** enable trace logging */
  trace?: TraceOptions;

  /** true for elements without children like kind(), and text(),
   * (to avoid intro log statement while tracing) */
  terminal?: boolean;

  preDisabled?: true;
}

interface ConstructArgs<T, N extends TagRecord> extends ParserArgs {
  fn: ParseFn<T, N>;
}

/** a composable parsing element */
export class Parser<T, N extends TagRecord = NoTags> {
  _traceName: string | undefined;
  traceSrc: Parser<any, any> | undefined;
  tagName: string | symbol | undefined;
  traceOptions: TraceOptions | undefined;
  terminal: boolean | undefined;
  preDisabled: true | undefined;
  fn: ParseFn<T, N>;

  constructor(args: ConstructArgs<T, N>) {
    this._traceName = args.traceName;
    this.tagName = args.tag;
    this.traceOptions = args.trace;
    this.terminal = args.terminal;
    this.traceSrc = args.traceSrc;
    this.preDisabled = args.preDisabled;
    this.fn = args.fn;
  }

  /** copy this parser with slightly different settings */
  _cloneWith(p: Partial<ConstructArgs<T, N>>): Parser<T, N> {
    return new Parser({
      traceName: this._traceName,
      traceSrc: this.traceSrc,
      tag: this.tagName,
      trace: this.traceOptions,
      terminal: this.terminal,
      preDisabled: this.preDisabled,
      fn: this.fn,
      ...p,
    });
  }

  /** run the parser given an already created parsing context */
  _run(context: ParserContext): OptParserResult<T, N> {
    return runParser(this, context);
  }

  /**
   * tag results with a name,
   *
   * tagged results can be retrived with map(r => r.tags.myName)
   * note that tagged results are collected into an array,
   * multiple matches with the same name (even from different nested parsers) accumulate
   */
  tag<K extends string | symbol>(name: K): Parser<T, N & { [key in K]: T[] }> {
    const p = this._cloneWith({
      tag: name,
      traceSrc: this,
      traceName: undefined,
    });
    return p as Parser<T, N & { [key in K]: T[] }>;
  }

  /** record a name for debug tracing */
  traceName(name: string): Parser<T, N> {
    return this._cloneWith({ traceName: name });
  }

  /** trigger tracing for this parser (and by default also this parsers descendants) */
  trace(opts: TraceOptions = {}): Parser<T, N> {
    return this._cloneWith({ trace: opts });
  }

  /** map results to a new value, or add to app state as a side effect.
   * Return null to cause the parser to fail.
   */
  map<U>(fn: ParserMapFn<T, N, U>): Parser<U, N> {
    return map(this, fn);
  }

  /** switch next parser based on results */
  toParser<U, V extends TagRecord>(
    fn: ToParserFn<T, N, U, V>,
  ): Parser<T | U, N & V> {
    return toParser(this, fn);
  }

  /** start parsing */
  parse(init: ParserInit): OptParserResult<T, N> {
    try {
      const {
        lexer,
        maxParseCount,
        srcMap,
        app = { context: {}, state: [] },
      } = init;
      return this._run({
        lexer,
        app,
        srcMap,
        _preParse: [],
        _parseCount: 0,
        _preCacheFails: new Map(),
        maxParseCount,
        _debugNames: [this.debugName],
      });
    } catch (e) {
      if (!(e instanceof ParseError)) {
        console.error(e);
      }
      return null;
    }
  }

  /** name of this parser for debugging/tracing */
  get debugName(): string {
    return (
      this._traceName ??
      this.traceSrc?._traceName ??
      this.tagName?.toString() ??
      "parser"
    );
  }
}

/** Create a Parser from a ParseFn
 * @param fn the parser function
 * @param args static arguments provided by the user as the parser is constructed
 */
export function parser<T, N extends TagRecord>(
  traceName: string,
  fn: ParseFn<T, N>,
  terminal?: boolean,
): Parser<T, N> {
  const terminalArg = terminal ? { terminal } : {};
  return new Parser<T, N>({ fn, traceName, ...terminalArg });
}

/** Create a Parser from a function that parses and returns a value (w/no child parsers) */
export function simpleParser<T>(
  traceName: string,
  fn: (ctx: ParserContext) => T | null | undefined,
): Parser<T, NoTags> {
  const parserFn: ParseFn<T, NoTags> = (ctx: ParserContext) => {
    const r = fn(ctx);
    if (r == null || r === undefined) return null;

    return { value: r, tags: {} };
  };

  return parser(traceName, parserFn, true);
}

/** modify the trace name of this parser */
export function setTraceName(
  parser: Parser<any, TagRecord>,
  traceName: string,
): void {
  parser._traceName = traceName;
}

/**
 * Execute a parser by running the core parsing fn given the parsing context
 * also:
 * . check for infinite loops
 * . log if tracing is enabled
 * . merge tagged results
 * . backtrack on failure
 * . rollback context on failure
 */
function runParser<T, N extends TagRecord>(
  p: Parser<T, N>,
  context: ParserContext,
): OptParserResult<T, N> {
  const { lexer, _parseCount = 0, maxParseCount } = context;

  // check for infinite looping
  context._parseCount = _parseCount + 1;
  // LATER counting tokens isn't so great to check for infinite looping. Possibly a count per parser per src position?
  if (maxParseCount && _parseCount > maxParseCount) {
    srcLog(lexer.src, lexer.position(), "infinite loop? ", p.debugName);
    return null;
  }

  const origAppContext = context.app.context;
  const origPosition = lexer.position();

  // setup trace logging if enabled and active for this parser
  const result = withTraceLogging<OptParserResult<T, N>>()(
    context,
    p.traceOptions,
    runInContext,
  );

  function runInContext(tContext: ParserContext): OptParserResult<T, N> {
    tContext._debugNames.push(p.debugName);
    const traceSuccessOnly = tContext._trace?.successOnly;
    if (!p.terminal && tracing && !traceSuccessOnly)
      parserLog(`..${p.debugName}`);

    if (!p.preDisabled) {
      execPreParsers(tContext);
    } else {
      tContext._preParse = [];
    }

    // run the parser function for this stage
    const result = p.fn(tContext);

    tContext._debugNames.pop();

    if (result === null || result === undefined) {
      // parser failed
      tracing && !traceSuccessOnly && parserLog(`x ${p.debugName}`);
      // parserLog("reset position to:", origPosition)
      lexer.position(origPosition);
      context.app.context = origAppContext;
      return null;
    } else {
      // parser succeeded
      tracing && parserLog(`✓ ${p.debugName}`);
      const value = result.value;
      let tags;
      if (p.tagName && result.value !== undefined) {
        // merge tagged result (if user set a name for this stage's result)
        tags = mergeTags(result.tags, {
          [p.tagName]: [result.value],
        }) as N;
      } else {
        tags = result.tags;
      }
      return { value, tags };
    }
  }

  return result;
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
    let preResult: OptParserResult<unknown, NoTags>;
    do {
      position = lexer.position();
      if (failCache.has(position)) break;

      preResult = pre._run(ctxNoPre);
    } while (preResult !== null && preResult !== undefined);

    failCache.add(position);
    lexer.position(position); // reset position to end of last successful parse
  });
}

type ParserMapFn<T, N extends TagRecord, U> = (
  results: ExtendedResult<T, N>,
) => U | null;

/** return a parser that maps the current results */
function map<T, N extends TagRecord, U>(
  p: Parser<T, N>,
  fn: ParserMapFn<T, N, U>,
): Parser<U, N> {
  return parser(`map`, (ctx: ParserContext): OptParserResult<U, N> => {
    const extended = runExtended(ctx, p);
    if (!extended) return null;

    const mappedValue = fn(extended);
    if (mappedValue === null) return null;

    return { value: mappedValue, tags: extended.tags };
  });
}

type ToParserFn<T, N extends TagRecord, X, Y extends TagRecord> = (
  results: ExtendedResult<T, N>,
) => Parser<X, Y> | undefined;

function toParser<T, N extends TagRecord, O, Y extends TagRecord>(
  p: Parser<T, N>,
  toParserFn: ToParserFn<T, N, O, Y>,
): Parser<T | O, N & Y> {
  return parser("toParser", (ctx: ParserContext) => {
    const extended = runExtended(ctx, p);
    if (!extended) return null;

    // run the supplied function to get a parser
    const newParser = toParserFn(extended);

    if (newParser === undefined) {
      return extended;
    }

    // run the parser returned by the supplied function
    const nextResult = newParser._run(ctx);
    // TODO merge names record from p to newParser
    return nextResult as any; // TODO fix typing
  });
}

const emptySet = new Set<string>();

/** set which token kinds to ignore while executing this parser and its descendants.
 * If no parameters are provided, no tokens are ignored. */
export function tokenSkipSet<T, N extends TagRecord>(
  ignore: Set<string> | undefined | null,
  mainParser: Parser<T, N>,
): Parser<T, N> {
  const ignoreSet = ignore ?? emptySet;
  return parser(
    `tokenIgnore ${[...ignoreSet.values()]}`,
    (ctx: ParserContext): OptParserResult<T, N> =>
      ctx.lexer.withIgnore(ignoreSet, () => mainParser._run(ctx)),
  );
}

/** attach a pre-parser to try parsing before this parser runs.
 * (e.g. to recognize comments that can appear almost anywhere in the main grammar) */
export function preParse<T, N extends TagRecord>(
  pre: Parser<unknown>,
  mainParser: Parser<T, N>,
): Parser<T, N> {
  return parser("preParse", (ctx: ParserContext): OptParserResult<T, N> => {
    const newCtx = { ...ctx, _preParse: [pre, ...ctx._preParse] };
    return mainParser._run(newCtx);
  });
}

/** disable a previously attached pre-parser,
 * e.g. to disable a comment preparser in a quoted string parser */
export function disablePreParse<A extends CombinatorArg>(
  arg: A,
): ParserFromArg<A> {
  const parser = parserArg(arg);
  return parser._cloneWith({ preDisabled: true });
}

/** run parser, return enriched results (to support map(), toParser()) */
export function runExtended<T, N extends TagRecord>(
  ctx: ParserContext,
  p: Parser<T, N>,
): ExtendedResult<T, N> | null {
  const origStart = ctx.lexer.position();

  const origResults = p._run(ctx);
  if (origResults === null) {
    ctx.lexer.position(origStart);
    return null;
  }
  const end = ctx.lexer.position();
  const src = ctx.lexer.src;

  // we've succeeded, so refine the start position to skip past ws
  // (we don't consume ws earlier, in case an inner parser wants to use different ws skipping)
  ctx.lexer.position(origStart);
  const start = ctx.lexer.skipIgnored();
  ctx.lexer.position(end);
  const { app, srcMap } = ctx;

  return { ...origResults, start, end, app, src, srcMap, ctx };
}
