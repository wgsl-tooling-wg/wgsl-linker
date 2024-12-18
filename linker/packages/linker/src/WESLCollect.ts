import { CollectContext, CollectPair, TagRecord } from "mini-parse";
import {
  AbstractElem2,
  AliasElem,
  ConstElem,
  IdentElem,
  ModuleElem,
  OverrideElem,
  TextElem,
  VarElem,
} from "./AbstractElems2.ts";
import { StableState, WeslParseContext } from "./ParseWESL.ts";
import { emptyBodyScope, Ident } from "./Scope.ts";
import { dlog } from "berry-pretty";

/** add reference Ident to current scope */
export function refIdent(cc: CollectContext) {
  const weslContext: WeslParseContext = cc.app.context;
  const { ident, identElem } = makeIdentElem(cc, "ref");
  weslContext.scope.idents.push(ident);
  addToOpenElems(cc, identElem);
  return identElem;
}

function addToOpenElems(cc: CollectContext, elem: AbstractElem2): void {
  const weslContext: WeslParseContext = cc.app.context;
  const { openElems } = weslContext;
  if (openElems && openElems.length) {
    const open = openElems[openElems.length - 1];
    open.contents.push(elem);
  }
}

/** add declaration Ident to current scope */
export function declIdent(cc: CollectContext) {
  const weslContext: WeslParseContext = cc.app.context;
  const { ident, identElem } = makeIdentElem(cc, "decl");
  weslContext.scope.idents.push(ident);

  addToOpenElems(cc, identElem);

  return identElem;
}

function makeIdentElem(cc: CollectContext, kind: Ident["kind"]) {
  const { src, start, end } = cc;
  const originalName = src.slice(start, end);
  // srcLog(cc.src, cc.start, kind, originalName);
  const ident: Ident = { kind, originalName };
  const identElem: IdentElem = { kind: "ident", start, end, src, ident };
  return { ident, identElem };
}

/** start a new child Scope */
export function startScope<T>(cc: CollectContext) {
  // ctxLog(r.ctx, "startScope");
  const { scope } = cc.app.context as WeslParseContext;
  const newScope = emptyBodyScope(scope);
  scope.children.push(newScope);
  cc.app.context.scope = newScope;
}

/** close current Scope and set current scope to parent */
export function completeScope<T>(cc: CollectContext) {
  // ctxLog(r.ctx, "completeScope");
  const weslContext = cc.app.context as WeslParseContext;
  const completedScope = weslContext.scope;
  const { parent } = completedScope;
  // TODO if scope is empty, drop it?
  if (parent) {
    weslContext.scope = parent;
  } else {
    // TODO should never happen
    const { idents, kind } = completedScope;
    console.log("ERR: completeScope, no parent scope", { kind, idents });
  }
}

// prettier-ignore
export type OpenElem<T extends AbstractElem2 = AbstractElem2> = 
  Pick< T, "kind" > & { contents: AbstractElem2[] };

// prettier-ignore
export type PartElem<T extends AbstractElem2 = AbstractElem2> = 
  Pick< T, "kind" | "start" | "end" > & { contents: AbstractElem2[] };

type VarLikeElem = VarElem | ConstElem | OverrideElem;

export function collectVar<N extends TagRecord>(): CollectPair<N, VarElem> {
  return collectVarLike("var");
}

export function collectConst<N extends TagRecord>(): CollectPair<N, ConstElem> {
  return collectVarLike("const");
}

// prettier-ignore
export function collectOverride<N extends TagRecord>(): 
    CollectPair<N, OverrideElem> {
  return collectVarLike("override");
}

function collectVarLike<E extends VarLikeElem, N extends TagRecord>(
  kind: E["kind"],
): CollectPair<N, E> {
  return collectElem(kind, (cc: CollectContext, openElem: PartElem<E>) => {
    const name = cc.tags.declIdent?.[0]!;
    const typeRef = cc.tags.typeRef?.[0];
    const contents = coverWithText(cc, openElem.contents);
    return { ...openElem, name, typeRef, contents } as E;
  });
}

export function collectAlias<N extends TagRecord>(): CollectPair<N, AliasElem> {
  return collectElem(
    "alias",
    (cc: CollectContext, openElem: PartElem<AliasElem>) => {
      const name = cc.tags.declIdent?.[0]!;
      const target = cc.tags.typeRef?.[0];
      const contents = coverWithText(cc, openElem.contents);
      return { ...openElem, name, target, contents };
    },
  );
}

export function collectModule<N extends TagRecord>(): CollectPair<
  N,
  ModuleElem
> {
  // dlog("collectModule.setup");
  return collectElem(
    "module",
    (cc: CollectContext, openElem: PartElem<ModuleElem>) => {
      const ccComplete = { ...cc, start: 0, end: cc.src.length }; // force module to cover entire source despite ws skipping
      const contents = coverWithText(ccComplete, openElem.contents); // TODO DRY
      const moduleElem: ModuleElem = { ...openElem, contents };
      // dlog("collectModule.inAfter", { moduleElem });
      const weslState: StableState = cc.app.stable;
      weslState.rootModule = moduleElem;
      return moduleElem;
    },
  );
}

export function collectElem<N extends TagRecord, V extends AbstractElem2>(
  kind: V["kind"],
  fn: (cc: CollectContext, partialElem: PartElem<V>) => V,
): CollectPair<N, V> {
  return {
    before: (cc: CollectContext) => {
      // dlog({ kind });
      const partialElem = { kind, contents: [] };
      const weslContext: WeslParseContext = cc.app.context;
      weslContext.openElems.push(partialElem);
    },
    after: (cc: CollectContext) => {
      // TODO refine start?
      const weslContext: WeslParseContext = cc.app.context;
      const partialElem = weslContext.openElems.pop()!;
      console.assert(partialElem && partialElem.kind === kind);
      const elem = fn(cc, { ...partialElem, start: cc.start, end: cc.end });
      addToOpenElems(cc, elem);
      // dlog("collectElem.after", elemToString(elem));

      return elem;
    },
  };
}

/** cover the entire source range with Elems by creating TextElems to
 * cover any parts of the source that are not covered by other elems */
export function coverWithText(
  cc: CollectContext,
  existing: AbstractElem2[],
): AbstractElem2[] {
  let { start: pos } = cc;
  const { end, src } = cc;
  const sorted = existing.sort((a, b) => a.start - b.start);

  const elems = sorted.flatMap(elem => {
    const result = pos < elem.start ? [makeTextElem(elem.start), elem] : [elem];
    pos = elem.end;
    return result;
  });

  if (pos < end) {
    elems.push(makeTextElem(end));
  }

  return elems;

  function makeTextElem(end: number): TextElem {
    return { kind: "text", start: pos, end, src };
  }
}
