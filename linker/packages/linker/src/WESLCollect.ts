import { CollectContext, CollectPair } from "mini-parse";
import {
  AbstractElem2,
  AliasElem,
  ConstElem,
  DeclarationElem,
  DeclIdentElem,
  ElemWithContents,
  FnElem,
  GlobalVarElem,
  IdentElem,
  ImportElem,
  ModuleElem,
  NameElem,
  OverrideElem,
  ParamElem,
  StructElem,
  StructMemberElem,
  TextElem,
  VarElem,
} from "./AbstractElems2.ts";
import { ImportTree, PathSegment, SimpleSegment } from "./ImportTree.ts";
import { StableState, WeslParseContext } from "./ParseWESL.ts";
import { DeclIdent, emptyBodyScope, Ident, RefIdent } from "./Scope.ts";

/** add an elem to the .contents array of the currently containing element */
function addToOpenElem(cc: CollectContext, elem: AbstractElem2): void {
  const weslContext: WeslParseContext = cc.app.context;
  const { openElems } = weslContext;
  if (openElems && openElems.length) {
    const open = openElems[openElems.length - 1];
    open.contents.push(elem);
  }
}

/** create reference Ident and add to context */
export function refIdent(cc: CollectContext) {
  const { src, start, end } = cc;
  const originalName = src.slice(start, end);

  const kind = "ref";
  const ident: RefIdent = { kind, originalName };
  const identElem: IdentElem = { kind, start, end, src, ident };

  saveIdent(cc, identElem);
  return identElem;
}

/** create declaration Ident and add to context */
export function declIdent(cc: CollectContext): DeclIdentElem {
  const { src, start, end } = cc;
  const originalName = src.slice(start, end);

  const kind = "decl";
  const weslContext: WeslParseContext = cc.app.context;
  const childScope = weslContext.scope;
  const declElem = null as any; // we'll set declElem later
  const ident: DeclIdent = { kind, originalName, scope: childScope, declElem }; // we'll set declElem later
  const identElem: DeclIdentElem = { kind, start, end, src, ident };

  saveIdent(cc, identElem);
  return identElem;
}

/** add Ident to current open scope, add IdentElem to current open element */
function saveIdent(cc: CollectContext, identElem: IdentElem | DeclIdentElem) {
  const { ident } = identElem;
  const weslContext: WeslParseContext = cc.app.context;
  weslContext.scope.idents.push(ident);
  addToOpenElem(cc, identElem);
}

/** start a new child Scope */
function startScope(cc: CollectContext) {
  const { scope } = cc.app.context as WeslParseContext;
  const newScope = emptyBodyScope(scope);
  scope.children.push(newScope);
  cc.app.context.scope = newScope;
}

/* close current Scope and set current scope to parent */
function completeScope(cc: CollectContext) {
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

type VarLikeElem =
  | GlobalVarElem
  | VarElem
  | ConstElem
  | OverrideElem
  | AliasElem;

export function collectVarLike<E extends VarLikeElem>(
  kind: E["kind"],
): CollectPair<E> {
  return collectElem(kind, (cc: CollectContext, openElem: PartElem<E>) => {
    const name = cc.tags.declIdent?.[0]!;
    const typeRef = cc.tags.typeRef?.[0];
    const partElem = { ...openElem, name, typeRef };
    const varElem = withTextCover(partElem, cc) as E;
    (name.ident as DeclIdent).declElem = varElem as DeclarationElem;
    return varElem;
  });
}

export function collectFn(): CollectPair<FnElem> {
  return collectElem("fn", (cc: CollectContext, openElem: PartElem<FnElem>) => {
    const name = cc.tags.fnName?.[0]! as DeclIdentElem;
    const params: ParamElem[] = cc.tags.fnParam?.flat(3) ?? [];
    const returnType: IdentElem | undefined = cc.tags.returnType?.flat(3)[0];
    const partElem: FnElem = { ...openElem, name, params, returnType };
    const fnElem = withTextCover(partElem, cc);
    (name.ident as DeclIdent).declElem = fnElem;
    return fnElem;
  });
}

export function collectFnParam(): CollectPair<ParamElem> {
  return collectElem(
    "param",
    (cc: CollectContext, openElem: PartElem<ParamElem>) => {
      const typeRef = cc.tags.typeRef?.[0]!;
      const name = cc.tags.paramName?.[0]!;
      const paramElem = { ...openElem, name, typeRef };
      return withTextCover(paramElem, cc);
    },
  );
}

export function collectStruct(): CollectPair<StructElem> {
  return collectElem(
    "struct",
    (cc: CollectContext, openElem: PartElem<StructElem>) => {
      const name = cc.tags.typeName?.[0]!;
      const members = cc.tags.members!;
      const structElem = { ...openElem, name, members };
      const elem = withTextCover(structElem, cc);
      (name.ident as DeclIdent).declElem = elem as DeclarationElem;
      return elem;
    },
  );
}

export function collectStructMember(): CollectPair<StructMemberElem> {
  return collectElem(
    "member",
    (cc: CollectContext, openElem: PartElem<StructMemberElem>) => {
      const name = cc.tags.nameElem?.[0]!;
      const typeRef = cc.tags.typeRef?.[0];
      const partElem = { ...openElem, name, typeRef };
      return withTextCover(partElem, cc);
    },
  );
}

export function collectNameElem(cc: CollectContext): NameElem {
  const { start, end, src } = cc;
  const name = src.slice(start, end);
  const elem: NameElem = { kind: "name", src, start, end, name };
  addToOpenElem(cc, elem);
  return elem;
}

// prettier-ignore
export function collectModule(): 
    CollectPair<ModuleElem > {
  return collectElem(
    "module",
    (cc: CollectContext, openElem: PartElem<ModuleElem>) => {
      const ccComplete = { ...cc, start: 0, end: cc.src.length }; // force module to cover entire source despite ws skipping
      const moduleElem: ModuleElem = withTextCover(openElem, ccComplete);
      const weslState: StableState = cc.app.stable;
      weslState.rootModule = moduleElem;
      return moduleElem;
    },
  );
}

export function importSegment(cc: CollectContext): SimpleSegment {
  const segOrig = cc.tags.segment?.[0] as string;
  const seg = segOrig === "." ? "package" : segOrig; // TODO convert legacy syntax for now
  return new SimpleSegment(seg, cc.tags.as?.[0]);
}

export function importTree(cc: CollectContext): ImportTree {
  const path = cc.tags.path?.flat() as PathSegment[]; // LATER fix typing
  return new ImportTree(path);
}

export function importElem(): CollectPair<ImportElem> {
  return collectElem(
    "import",
    (cc: CollectContext, openElem: PartElem<ImportElem>) => {
      const path = cc.tags.seg?.flat(8) as PathSegment[]; // LATER ts typing
      const imports = new ImportTree(path);
      const partialElem: ImportElem = { ...openElem, imports };
      const importElem = withTextCover(partialElem, cc);
      (cc.app.stable as StableState).imports.push(imports);
      return importElem;
    },
  );
}

/** collect a scope start starts before and ends after a parser */
export function scopeCollect(): CollectPair<void> {
  return {
    before: startScope,
    after: completeScope,
  };
}

export function collectSimpleElem<V extends AbstractElem2 & ElemWithContents>(
  kind: V["kind"],
): CollectPair<V> {
  return collectElem(kind, (cc, part) => withTextCover(part, cc) as V);
}

function collectElem<V extends AbstractElem2>(
  kind: V["kind"],
  fn: (cc: CollectContext, partialElem: PartElem<V>) => V,
): CollectPair<V> {
  return {
    before: (cc: CollectContext) => {
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
      addToOpenElem(cc, elem);
      return elem;
    },
  };
}

/**
 * @return a copy of the element with contents extended
 * to include TextElems to cover the entire range.
 */
function withTextCover<T extends ElemWithContents>(
  elem: T,
  cc: CollectContext,
): T {
  const contents = coverWithText(cc, elem.contents);
  return { ...elem, contents };
}

/** cover the entire source range with Elems by creating TextElems to
 * cover any parts of the source that are not covered by other elems
 * @returns the existing elems combined with any new TextElems, in src order */
function coverWithText(
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
