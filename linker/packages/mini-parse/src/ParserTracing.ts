import { Parser, ParserContext, setTraceName } from "./Parser.js";

/** true if parser tracing is enabled */
export let tracing = false;

/** true if tracing/logging messages should show character positions */
export let tracePos = false;

/** true if parser debug names are enabled */
export let debugNames = false;

/** base logger. (can be overriden to a capturing logger for tests) */
export let logger = console.log;

/** no-op logger, for when tracing is disabled */
const noLog: typeof console.log = () => {};

/** logger while tracing is active, otherwise noop */
export let parserLog: typeof console.log = noLog;

/** enable tracing of parser activity via .trace() */
export function enableTracing(enable = true): void {
  tracing = enable;
  debugNames = enable;
}

/** for tests, to show character positions in log messages */
export function enableTracePos(enable = true): void {
  tracePos = enable;
}

/** mutate the provided to set their trace names (if tracing is enabled) */
export function setTraceNames(parsers: Record<string, Parser<any, any>>): void {
  if (tracing) {
    Object.entries(parsers).forEach(([name, parser]) => {
      setTraceName(parser, name);
    });
  }
}

/** options to .trace() on a parser stage */
export interface TraceOptions {
  /** trace this parser, but not children */
  shallow?: boolean;

  /** don't trace this parser or its children, even if the parent is tracing */
  hide?: boolean;

  /** start tracing at this character position.
   * Note that start should include ws skipped prior to the first token you want to see in the trace. */
  start?: number;

  end?: number;
  /** trace less info */
  successOnly?: boolean;
}

/** runtime stack info about currently active trace logging */
export interface TraceContext {
  indent: number;
  start?: number;
  end?: number;
  successOnly?: boolean;
}

/** use temporary logger for tests */
export function _withBaseLogger<T>(logFn: typeof console.log, fn: () => T): T {
  const orig = logger;
  try {
    logger = logFn;
    return fn();
  } finally {
    logger = orig;
  }
}

export interface TraceLogging {
  tstate: ParserContext;
}

type TraceLoggingFn<T> = (
  ctx: any,
  trace: TraceOptions | undefined,
  fn: (ctx: ParserContext) => T,
) => T;

export const withTraceLogging = <T>(): TraceLoggingFn<T> =>
  tracing ? withTraceLoggingInternal : stubTraceLogging;

function stubTraceLogging<T>(
  ctx: any,
  trace: TraceOptions | undefined,
  fn: (ctx: ParserContext) => T,
): T {
  return fn(ctx);
}

/** setup trace logging inside a parser stage */
function withTraceLoggingInternal<T>(
  // _trace has trace settings from parent
  ctx: ParserContext,
  // trace has trace options set on this stage
  trace: TraceOptions | undefined,
  fn: (ctxWithTracing: ParserContext) => T,
): T {
  let { _trace } = ctx;

  // log if we're starting or inheriting a trace and we're inside requested position range
  let logging: boolean = (!!_trace || !!trace) && !trace?.hide;
  if (logging) {
    const { start = 0, end = 1e20 } = { ..._trace, ...trace };
    const pos = ctx.lexer.position();
    if (pos < start || pos > end) {
      logging = false;
    }
  }

  // if we're inheriting a trace, but this one is marked hide, stop inheriting further
  if (_trace && (trace?.hide || trace?.shallow)) {
    _trace = undefined;
  }

  // start inheriting tracing if deep trace is set on this stage
  if (!_trace && trace && !trace?.shallow && !trace?.hide) {
    _trace = { indent: 0, ...trace };
  }

  // setup appropriate logging for this stage
  let tlog = noLog;
  if (logging) {
    const pad = currentIndent(_trace);
    tlog = (...msgs: any[]) => {
      logger(`${pad}${msgs[0]}`, ...msgs.slice(1));
    };
  }

  // indent further for nested stages
  if (_trace) {
    _trace = { ..._trace, indent: _trace.indent + 1 };
  }

  return withLogger(tlog, () => fn({ ...ctx, _trace }));
}

/** padding for current indent level */
function currentIndent(ctx?: TraceContext): string {
  return "  ".repeat(ctx?.indent || 0);
}

/** use temporary logger, to turn tracing on/off */
function withLogger<T>(logFn: typeof console.log, fn: () => T): T {
  const orig = parserLog;
  try {
    parserLog = logFn;
    return fn();
  } finally {
    parserLog = orig;
  }
}
