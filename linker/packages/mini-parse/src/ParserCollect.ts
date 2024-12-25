import { dlog } from "berry-pretty";
import { Lexer } from "./MatchingLexer.js";
import {
  AppState,
  OptParserResult,
  parser,
  Parser,
  ParserContext,
  TagRecord,
  trackChildren,
} from "./Parser.js";

/** an entry in the table of deferred functions for collect() and tag() */
export interface CollectFnEntry<N extends TagRecord, V> {
  collectFn: CollectFn<N, V>;
  collected: CollectInfo;
  debugName?: string;
}

export interface CollectInfo {
  start: number;
  end: number;
}

/** info passed to the collect fn */
export interface CollectContext extends CollectInfo {
  tags: TagRecord;
  src: string;
  app: AppState<any>;
  _values: CollectValue[];
}

/** a stack of collected values  */
interface CollectValue {
  value: any;
  openArray: any[] | undefined;
}

/** a user supplied function for collecting info from the parse */
export type CollectFn<N extends TagRecord, V> = (ctx: CollectContext) => V;

/** a user supplied pair functions for collecting info from the parse */
export interface CollectPair<N extends TagRecord, V> {
  before: (cc: CollectContext) => void;
  after: CollectFn<N, V>;
}

/** Queue a collection function that runs later, when a commit() is parsed.
 * Collection functions are dropped with parser backtracking, so
 * only succsessful parses are collected. */
export function collect<N extends TagRecord, T, V>(
  p: Parser<T, N>,
  collectFn: CollectFn<N, V> | CollectPair<N, V>,
  debugName: string, // for debug
): Parser<T, N> {
  const afterFn: CollectFn<N, V> =
    (collectFn as CollectPair<N, V>).after ?? collectFn;
  const beforeFn = (collectFn as Partial<CollectPair<N, V>>).before;

  const collectParser = parser(
    `collect`,
    (ctx: ParserContext): OptParserResult<T, N> => {
      // if (tracing && ctx._trace) {
      // const deepName = ctx._debugNames.join(" > ");
      // ctxLog(ctx, `collect ${deepName}`);
      // }
      const origStart = ctx.lexer.position();
      if (beforeFn) {
        queueCollectFn(ctx, origStart, beforeFn, `${debugName}.before`);
      }

      return runAndCollectAfter(p, ctx, afterFn, debugName);
    },
  );
  collectParser._collection = true;
  trackChildren(collectParser, p);
  return collectParser;
}

/** tag most recent collect result with a name that can be
 * referenced in later collection. */
export function ctag<N extends TagRecord, T>(
  p: Parser<T, N>,
  name: string,
): Parser<T, N> {
  const cp = parser(`ctag`, (ctx: ParserContext): OptParserResult<T, N> => {
    return runAndCollectAfter(
      p,
      ctx,
      (cc: CollectContext) => {
        const valueEntry = last(cc._values);
        addTagValue(cc.tags, name, valueEntry.value);
      },
      `ctag ${name}`,
    );
  });
  trackChildren(cp, p);
  return cp;
}

/** run the parser and if it succeeds, queue a provided function to run
 * during commit() */
function runAndCollectAfter<T, N extends TagRecord>(
  p: Parser<T, N>,
  ctx: ParserContext,
  collectFn: CollectFn<any, any>,
  debugName: string = "",
): OptParserResult<T, N> {
  const origStart = ctx.lexer.position();
  const result = p._run(ctx);
  if (result) {
    queueCollectFn(ctx, origStart, collectFn, debugName);
  }
  return result;
}

function queueCollectFn<T, N extends TagRecord>(
  ctx: ParserContext,
  origStart: number,
  collectFn: CollectFn<any, any>,
  debugName: string,
) {
  const collected = refinePosition(ctx.lexer, origStart);
  ctx._collect.push({
    collected,
    collectFn,
    debugName,
  });
}

/** tag parse results or collect() results with a name that can be
 * referenced in later collection. */
export function tag2<N extends TagRecord, T>(
  p: Parser<T, N>,
  name: string,
): Parser<T, N> {
  const cp = parser(`tag2`, (ctx: ParserContext): OptParserResult<T, N> => {
    const origStart = ctx.lexer.position();
    const result = p._run(ctx);

    // tag the parser resuts (unless it's a collect() parser)
    if (result) {
      const tagFn = (ctx: CollectContext) =>
        addTagValue(ctx.tags, name, result.value);
      queueCollectFn(ctx, origStart, tagFn, `tag2 ${name}`);
    }
    return result;
  });
  trackChildren(cp, p);
  return cp;
}

/** add a tagged value to a TagRecord */
function addTagValue(tags: TagRecord, name: string, value: any) {
  if (tags[name] === undefined) {
    tags[name] = [];
  }
  tags[name].push(value);
  // dlog({ tags });
}

/** When the provided parser succeeds,
 * run any pending collect() fns, and clear the pending list */
export function commit<N extends TagRecord, T>(
  p: Parser<T, N>,
  commitDebugName?: string,
): Parser<T, N> {
  const commitParser = parser(
    `commit`,
    (ctx: ParserContext): OptParserResult<T, N> => {
      const result = p._run(ctx);
      if (result) {
        const tags: Record<string, any> = {};
        // dlog(`commit ${commitDebugName}`);
        const { app, lexer } = ctx;
        const { src } = lexer;
        // ctx._collect.forEach(entry => {
        //   const { start: start, end } = entry.collected;
        //   dlog("commit, prep:", entry.debugName, { collected: src.slice(start, end), start, end });
        // });
        const _values: CollectValue[] = [{ value: null, openArray: undefined }];
        ctx._collect.forEach(entry => {
          const { collectFn, collected } = entry;
          const collectContext: CollectContext = {
            tags,
            ...collected,
            src,
            app,
            _values,
          };

          const collectResult = collectFn(collectContext);
          saveCollectValue(collectContext, collectResult);
        });
        ctx._collect.length = 0;
      }
      return result;
    },
  );

  trackChildren(commitParser, p);
  return commitParser;
}

function saveCollectValue(cc: CollectContext, value: any) {
  const valueEntry = last(cc._values);
  if (valueEntry.openArray !== undefined) {
    valueEntry.openArray.push(value);
  } else {
    valueEntry.value = value;
  }
}

function last<T>(elems: T[]): T {
  return elems[elems.length - 1];
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
  return { start: start, end };
}
