import { ParserContext } from "./ParserCombinator.js";

export let tracing = false;

/** enable tracing of parser activity via .trace() */
export function enableTracing() {
  tracing = true;
}

/** base logger when tracing is enabled. (can be overriden to a capturing logger for tests) */
let logger = console.log;

/** no-op logger, for when tracing is disabled */
const noLog: typeof console.log = () => {};

/** logger while tracing is active, otherwise noop */
export let parserLog: typeof console.log = noLog;

/** options to .trace() on a parser stage */
export interface TraceOptions {
  shallow?: boolean;
  start?: number;
  end?: number;
}

/** runtime stack info about currently active trace logging */
export interface TraceContext {
  indent: number;
  start?: number;
  end?: number;
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

export let withTraceLogging = () =>
  tracing ? withTraceLoggingInternal : stubTraceLogging;

function stubTraceLogging<T>(ctx: any, trace: any, fn: (a: any) => T): T {
  return fn(ctx);
}

/** setup trace logging inside a parser stage */
function withTraceLoggingInternal<T>(
  // _trace has trace settings from parent
  ctx: ParserContext,
  // trace has trace options set on this stage
  trace: TraceOptions | undefined,
  fn: (ctxWithTracing: ParserContext) => T
): T {
  let { _trace } = ctx;

  // log if we're starting or inheriting a trace and we're in any position range
  let logging: boolean = !!_trace || !!trace;
  if (logging) {
    const { start = 0, end = 1e20 } = { ..._trace, ...trace };
    const pos = ctx.lexer.position();
    if (pos < start || pos > end) {
      logging = false;
    }
  }

  // start inheriting tracing if deep trace is set on this stage
  if (!_trace && trace && !trace?.shallow) {
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
function currentIndent(debug?: TraceContext) {
  return "  ".repeat(debug?.indent || 0);
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