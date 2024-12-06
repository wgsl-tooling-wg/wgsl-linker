import { Lexer } from "./MatchingLexer.js";
import {
  AppState,
  OptParserResult,
  parser,
  Parser,
  ParserContext,
  TagRecord,
} from "./Parser.js";

export interface CollectFnEntry<N extends TagRecord, V> {
  collectFn: CollectFn<N, V>;
  collected: CollectInfo;
}

export interface CollectInfo {
  start: number;
  end: number;
  debugName?: string;
}

/** info passed to the collect fn */
export interface CollectContext extends CollectInfo {
  tags: TagRecord;
  src: string;
  app: AppState<any>;
}

/** a user supplied for collecting info from the */ 
export type CollectFn<N extends TagRecord, V> = (ctx: CollectContext) => V;

/** Queue a collection function that runs later, when a commit() is parsed.
 * Collection functions are dropped with parser backtracking, so
 * only succsessful parses are collected. */
export function collect<N extends TagRecord, T, V>(
  p: Parser<T, N>,
  collectFn: CollectFn<N, V>,
  debugName: string, // for debug
): Parser<T, N> {
  return parser(`collect`, (ctx: ParserContext): OptParserResult<T, N> => {
    // if (tracing && ctx._trace) {
    //   const deepName = ctx._debugNames.join(" > ");
    //   ctxLog(ctx, `collect '${collectName}' ${deepName}`);
    // }
    const origStart = ctx.lexer.position();
    const value = p._run(ctx);
    if (value !== null) {
      const collected = refinePosition(ctx.lexer, origStart);
      collected.debugName = debugName;
      ctx._collect.push({ collected, collectFn });
    }
    return value;
  });
}

export function tag2<N extends TagRecord, T, V>(
  p: Parser<T, N>,
  name: string,
): Parser<T, N> {
  return parser(`tag2`, (ctx: ParserContext): OptParserResult<T, N> => {
    const origStart = ctx.lexer.position();
    const result = p._run(ctx);
    if (result) {
      const { start, end } = refinePosition(ctx.lexer, origStart);
      const collected = { start, end };
      ctx._collect.push({
        collected,
        collectFn: ctx => {
          const { tags } = ctx;
          if (tags[name] === undefined) {
            tags[name] = [];
          }
          tags[name].push(result.value);
          // dlog({ tags });
        },
      });
    }
    return result;
  });
}

/** When the provided parser succeeds, 
 * run any pending collect() fns, and clear the pending list */
export function commit<N extends TagRecord, T>(
  p: Parser<T, N>,
  debugName?: string,
): Parser<T, N> {
  return parser(`commit`, (ctx: ParserContext): OptParserResult<T, N> => {
    const result = p._run(ctx);
    if (result !== null) {
      const tags = {};
      // dlog(`commit ${debugName}`, { entries: ctx._collect.length });
      ctx._collect.forEach(({ collectFn, collected }) => {
        const { app, lexer } = ctx;
        const { src } = lexer;
        const collectContext: CollectContext = { tags, ...collected, src, app };
        // const { start, end, debugName } = collected;
        // dlog({ collected: src.slice(start, end), debugName });
        collectFn(collectContext);
      });
      ctx._collect.length = 0;
    }
    return result;
  });
}

/** remove any pending collections that that are obsolete after backtracking */
export function rmObsoleteCollects(
  collect: CollectFnEntry<any, any>[],
  position: number,
) {
  // find the last valid collection
  let i = collect.length - 1;
  while (i >= 0 && collect[i].collected.start >= position) {
    i--;
  }
  // truncate the list to drop any invalid ones
  collect.length = i + 1;
}

/** We've succeeded in a parse, so refine the start position to skip past ws
 * (we don't consume ws earlier, in case an inner parser wants to use different ws skipping)
 */
function refinePosition(lexer: Lexer, origStart: number): CollectInfo {
  const end = lexer.position();
  lexer.position(origStart);
  const start = lexer.skipIgnored();
  // dlog({slice: lexer.src.slice(start, end)});
  lexer.position(end);
  return { start, end };
}
