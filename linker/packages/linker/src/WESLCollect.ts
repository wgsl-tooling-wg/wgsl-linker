import { CollectContext, CollectPair, tracing } from "mini-parse";
import {
  AbstractElem,
  AliasElem,
  ConstElem,
  DeclarationElem,
  DeclIdentElem,
  ElemWithContents,
  FnElem,
  GlobalVarElem,
  ImportElem,
  ModuleElem,
  NameElem,
  OverrideElem,
  ParamElem,
  RefIdentElem,
  StructElem,
  StructMemberElem,
  TextElem,
  VarElem,
} from "./AbstractElems.ts";
import {
  ImportTree,
  PathSegment,
  SegmentList,
  SimpleSegment,
} from "./ImportTree.ts";
import {
  StableState,
  WeslAST,
  WeslParseContext,
  WeslParseState,
} from "./ParseWESL.ts";
import { DeclIdent, emptyBodyScope, RefIdent, Scope } from "./Scope.ts";
import { dlog } from "berry-pretty";

/** add an elem to the .contents array of the currently containing element */
function addToOpenElem(cc: CollectContext, elem: AbstractElem): void {
  const weslContext: WeslParseContext = cc.app.context;
  const { openElems } = weslContext;
  if (openElems && openElems.length) {
    const open = openElems[openElems.length - 1];
    open.contents.push(elem);
  }
}

/** create reference Ident and add to context */
export function refIdent(cc: CollectContext): RefIdentElem {
  const { src, start, end } = cc;
  const app = cc.app as WeslParseState;
  const { scope } = app.context;
  const { srcModule } = app.stable;
  const originalName = src.slice(start, end);

  const kind = "ref";
  const ident: RefIdent = { kind, originalName, ast: cc.app.stable, scope };
  const identElem: RefIdentElem = { kind, start, end, srcModule, ident };
  ident.refIdentElem = identElem;

  saveIdent(cc, identElem);
  return identElem;
}

/** create declaration Ident and add to context */
export function declIdentElem(cc: CollectContext): DeclIdentElem {
  const { src, start, end } = cc;
  const app = cc.app as WeslParseState;
  const { srcModule } = app.stable;
  const originalName = src.slice(start, end);

  const kind = "decl";
  const declElem = null as any; // we'll set declElem later
  const ident: DeclIdent = { kind, originalName, scope: null as any, declElem }; // we'll set declElem later
  const identElem: DeclIdentElem = { kind, start, end, srcModule, ident };

  saveIdent(cc, identElem);
  return identElem;
}

let identId = 0;
/** add Ident to current open scope, add IdentElem to current open element */
function saveIdent(
  cc: CollectContext,
  identElem: RefIdentElem | DeclIdentElem,
) {
  const { ident } = identElem;
  ident.id = identId++;
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
  // srcLog(cc.src, cc.start, "startScope", newScope.id);
}

/* close current Scope and set current scope to parent */
function completeScope(cc: CollectContext): Scope {
  const weslContext = cc.app.context as WeslParseContext;
  const completedScope = weslContext.scope;
  // srcLog(cc.src, cc.start, "completeScope", completedScope.id);
  // console.log(scopeIdentTree(completedScope));
  const { parent } = completedScope;
  if (parent) {
    weslContext.scope = parent;
  } else if (tracing) {
    const { idents, kind } = completedScope;
    console.log("ERR: completeScope, no parent scope", { kind, idents });
  }
  return completedScope;
}

// prettier-ignore
export type OpenElem<T extends AbstractElem = AbstractElem> = 
  Pick< T, "kind" > & { contents: AbstractElem[] };

// prettier-ignore
export type PartElem<T extends AbstractElem = AbstractElem> = 
  Pick< T, "kind" | "start" | "end" > & { contents: AbstractElem[] };

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
    // dlog({ tags: [...Object.keys(cc.tags)] });
    const name = cc.tags.declIdent?.[0] as DeclIdentElem;
    const typeRef = cc.tags.typeRef?.[0] as RefIdentElem;
    const decl_scope = cc.tags.decl_scope?.[0] as Scope;
    const partElem = { ...openElem, name, typeRef };
    const varElem = withTextCover(partElem, cc) as E;
    (name.ident as DeclIdent).declElem = varElem as DeclarationElem;
    name.ident.scope = decl_scope;
    return varElem;
  });
}

export function collectFn(): CollectPair<FnElem> {
  return collectElem("fn", (cc: CollectContext, openElem: PartElem<FnElem>) => {
    const name = cc.tags.fnName?.[0] as DeclIdentElem;
    const body_scope = cc.tags.body_scope?.[0] as Scope;
    const params: ParamElem[] = cc.tags.fnParam?.flat(3) ?? [];
    const returnType: RefIdentElem | undefined = cc.tags.returnType?.flat(3)[0];
    const partElem: FnElem = { ...openElem, name, params, returnType };
    const fnElem = withTextCover(partElem, cc);
    (name.ident as DeclIdent).declElem = fnElem;
    name.ident.scope = body_scope;

    return fnElem;
  });
}

export function collectFnParam(): CollectPair<ParamElem> {
  return collectElem(
    "param",
    (cc: CollectContext, openElem: PartElem<ParamElem>) => {
      const name = cc.tags.paramName?.[0]! as DeclIdentElem;
      const typeRef = cc.tags.typeRef?.[0]! as RefIdentElem;
      const elem: ParamElem = { ...openElem, name, typeRef };
      const paramElem = withTextCover(elem, cc);
      name.ident.declElem = paramElem;

      return paramElem;
    },
  );
}

export function collectStruct(): CollectPair<StructElem> {
  return collectElem(
    "struct",
    (cc: CollectContext, openElem: PartElem<StructElem>) => {
      dlog({ tags: [...Object.keys(cc.tags)] });
      dlog({ attributes: cc.tags.attributes?.flat(8) });
      const name = cc.tags.typeName?.[0] as DeclIdentElem;
      const members = cc.tags.members as StructMemberElem[];
      name.ident.scope = cc.tags.struct_scope?.[0] as Scope;
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
  const { start, end, src, app } = cc;
  const { srcModule } = app.stable as WeslAST;
  const name = src.slice(start, end);
  const elem: NameElem = { kind: "name", srcModule, start, end, name };
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
      weslState.moduleElem = moduleElem;
      return moduleElem;
    },
  );
}

export function importList(cc: CollectContext): SegmentList {
  const list = cc.tags.list as PathSegment[];
  return new SegmentList(list);
}

export function importSegment(cc: CollectContext): SimpleSegment {
  const segOrig = cc.tags.segment?.[0] as string;
  const seg = segOrig === "." ? "package" : segOrig; // TODO convert legacy syntax for now
  return new SimpleSegment(seg, cc.tags.as?.[0]);
}

export function importTree(cc: CollectContext): ImportTree {
  const path = cc.tags.p?.flat() as PathSegment[]; // LATER fix typing
  return new ImportTree(path);
}

export function importElem(): CollectPair<ImportElem> {
  return collectElem(
    "import",
    (cc: CollectContext, openElem: PartElem<ImportElem>) => {
      const path = cc.tags.p as PathSegment[]; // LATER ts typing
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

export function collectSimpleElem<V extends AbstractElem & ElemWithContents>(
  kind: V["kind"],
): CollectPair<V> {
  return collectElem(kind, (cc, part) => withTextCover(part, cc) as V);
}

function collectElem<V extends AbstractElem>(
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
  existing: AbstractElem[],
): AbstractElem[] {
  let { start: pos } = cc;
  const { end, app } = cc;
  const ast: WeslAST = app.stable;
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
    return { kind: "text", start: pos, end, srcModule: ast.srcModule };
  }
}
