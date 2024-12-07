import { dlog } from "berry-pretty";
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
  tagNames?: Set<string>;
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
  const collectParser = parser(
    `collect`,
    (ctx: ParserContext): OptParserResult<T, N> => {
      // if (tracing && ctx._trace) {
      //   const deepName = ctx._debugNames.join(" > ");
      //   ctxLog(ctx, `collect '${collectName}' ${deepName}`);
      // }
      const origStart = ctx.lexer.position();
      const value = p._run(ctx);
      if (value !== null) {
        // dlog("collect", debugName );
        const collected = refinePosition(ctx.lexer, origStart);
        collected.debugName = debugName;
        let fn = collectFn;
        const { _ctag } = collectParser;
        if (_ctag) {
          // dlog("collect tag", { ctag: _ctag});
          // dlog({collectParser});
          fn = (cc: CollectContext): any => {
            const result = collectFn(cc);
            addTagValue(cc.tags, _ctag, result);
          };
        }
        const entry = { collected, collectFn: fn };
        (collectParser as any)._entry = entry;
        ctx._collect.push(entry);
      }
      return value;
    },
  );
  collectParser._collection = true;
  (collectParser as any).__x = "X";
  return collectParser;
}

/** tag parse results or collect() results with a name that can be
 * referenced in later collection. */
export function tag2<N extends TagRecord, T, V>(
  p: Parser<T, N>,
  name: string,
): Parser<T, N> {
  if (p._collection) {
    // if we're tagging a collect() parser, signal collect() to tag its results
    p._ctag = name;
    // dlog("tagging collect", { name, p });
  }
  return parser(`tag2`, (ctx: ParserContext): OptParserResult<T, N> => {
    const origStart = ctx.lexer.position();
    const result = p._run(ctx);

    // tag the parser resuts (unless it's a collect() parser)
    if (result && !p._collection) {
      const { start, end } = refinePosition(ctx.lexer, origStart);
      const collected = { start, end };
      ctx._collect.push({
        collected,
        collectFn: ctx => {
          const { tags } = ctx;
          addTagValue(tags, name, result.value);
        },
      });
    }
    return result;
  });
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
  debugName?: string,
): Parser<T, N> {
  return parser(`commit`, (ctx: ParserContext): OptParserResult<T, N> => {
    const result = p._run(ctx);
    if (result !== null) {
      const tags: Record<string, any> = {};
      // dlog(`commit ${debugName}`, { entries: ctx._collect.length });
      ctx._collect.forEach(({ collectFn, tagNames, collected }) => {
        const { app, lexer } = ctx;
        const { src } = lexer;
        const collectContext: CollectContext = { tags, ...collected, src, app };

        const { start, end, debugName } = collected;
        const collectResult = collectFn(collectContext);
        // dlog({
        //   collected: src.slice(start, end),
        //   debugName,
        //   tagNames,
        //   collectResult,
        // });

        // if tags are defined on this collect(), update tags with the result
        if (tagNames && collectResult !== undefined) {
          tagNames.forEach(name => {
            // dlog("commit tagging", { name, collectResult });
            addTagValue(tags, name, collectResult);
          });
        }
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
