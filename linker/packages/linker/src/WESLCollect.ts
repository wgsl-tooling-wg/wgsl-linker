import { CollectContext, CollectPair, srcLog, tracing } from "mini-parse";
import {
  AbstractElem,
  AliasElem,
  AttributeElem,
  ConstElem,
  DeclarationElem,
  DeclIdentElem,
  ElemWithContents,
  ExpressionElem,
  FnElem,
  GlobalVarElem,
  GrammarElem,
  ImportElem,
  ModuleElem,
  NameElem,
  OverrideElem,
  FnParamElem,
  RefIdentElem,
  SimpleMemberRef,
  StructElem,
  StructMemberElem,
  TextElem,
  TypeRefElem,
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
export type OpenElem<T extends ElemWithContents = ElemWithContents> = 
  Pick< T, "kind" | "contents">;

// prettier-ignore
export type PartElem<T extends ElemWithContents = ElemWithContents > = 
  Pick< T, "kind" | "start" | "end" | "contents"> ;

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
    const name = cc.tags.declIdent?.[0] as DeclIdentElem;
    const typeRef = cc.tags.typeRefElem?.[0] as TypeRefElem;
    const decl_scope = cc.tags.decl_scope?.[0] as Scope;
    const partElem = { ...openElem, name, typeRef };
    const varElem = withTextCover(partElem, cc) as E;
    (name.ident as DeclIdent).declElem = varElem as DeclarationElem;
    name.ident.scope = decl_scope;
    return varElem;
  });
}

export const collectFn = collectElem(
  "fn",
  (cc: CollectContext, openElem: PartElem<FnElem>) => {
    const name = cc.tags.fnName?.[0] as DeclIdentElem;
    const body_scope = cc.tags.body_scope?.[0] as Scope;
    const params: FnParamElem[] = cc.tags.fnParam?.flat(3) ?? [];
    const returnType: TypeRefElem | undefined = cc.tags.returnType?.flat(3)[0];
    const partElem: FnElem = { ...openElem, name, params, returnType };
    const fnElem = withTextCover(partElem, cc);
    (name.ident as DeclIdent).declElem = fnElem;
    name.ident.scope = body_scope;

    return fnElem;
  },
);

export const collectFnParam = collectElem(
  "param",
  (cc: CollectContext, openElem: PartElem<FnParamElem>) => {
    const name = cc.tags.paramName?.[0]! as DeclIdentElem;
    const typeRef = cc.tags.typeRefElem?.[0]! as TypeRefElem;
    const elem: FnParamElem = { ...openElem, name, typeRef };
    const paramElem = withTextCover(elem, cc);
    name.ident.declElem = paramElem;

    return paramElem;
  },
);

export const collectStruct = collectElem(
  "struct",
  (cc: CollectContext, openElem: PartElem<StructElem>) => {
    // dlog({ attributes: cc.tags.attributes?.flat(8).map(e => e && elemToString(e)) });
    const name = cc.tags.typeName?.[0] as DeclIdentElem;
    const members = cc.tags.members as StructMemberElem[];
    name.ident.scope = cc.tags.struct_scope?.[0] as Scope;
    const structElem = { ...openElem, name, members };
    const elem = withTextCover(structElem, cc);
    (name.ident as DeclIdent).declElem = elem as DeclarationElem;

    return elem;
  },
);

export const collectStructMember = collectElem(
  "member",
  (cc: CollectContext, openElem: PartElem<StructMemberElem>) => {
    // dlog("structMember", { tags: [...Object.keys(cc.tags)] });
    const name = cc.tags.nameElem?.[0]!;
    const typeRef = cc.tags.typeRefElem?.[0];
    const attributes = cc.tags.attribute?.flat(3) as AttributeElem[];
    const partElem = { ...openElem, name, attributes, typeRef };
    return withTextCover(partElem, cc);
  },
);

export const collectAttribute = collectElem(
  "attribute",
  (cc: CollectContext, openElem: PartElem<AttributeElem>) => {
    const params = cc.tags.attrParam as ExpressionElem[];
    const name = cc.tags.name?.[0]! as string;
    const partElem: AttributeElem = { ...openElem, params, name };
    return withTextCover(partElem, cc);
  },
);

export const typeRefCollect = collectElem(
  "type",
  (cc: CollectContext, openElem: PartElem<TypeRefElem>) => {
    const templateParams = cc.tags.templateParam?.flat(3);
    const typeRef = cc.tags.typeRefName?.[0] as string | RefIdentElem;
    const name = typeof typeRef === "string" ? typeRef : typeRef.ident;
    const partElem = { ...openElem, name, templateParams };
    // dlog("typeRefCollect", { tags: [...Object.keys(cc.tags)] });
    // collectLog(cc, "typeRefCollect", elemToString(partElem));
    // dlog({ typeRefCollect: elemToString(partElem) });
    return withTextCover(partElem, cc);
  },
);

export const expressionCollect = collectElem(
  "expression",
  (cc: CollectContext, openElem: PartElem<ExpressionElem>) => {
    const partElem = { ...openElem };
    return withTextCover(partElem, cc);
  },
);

export const memberRefCollect = collectElem(
  "memberRef",
  (cc: CollectContext, openElem: PartElem<SimpleMemberRef>) => {
    const { component, structRef } = cc.tags;
    const member = component![0] as NameElem;
    const name = structRef?.flat()[0] as RefIdentElem;

    const partElem: SimpleMemberRef = { ...openElem, name, member };
    return withTextCover(partElem, cc) as any;
  },
);

export function collectNameElem(cc: CollectContext): NameElem {
  const { start, end, src, app } = cc;
  const { srcModule } = app.stable as WeslAST;
  const name = src.slice(start, end);
  const elem: NameElem = { kind: "name", srcModule, start, end, name };
  addToOpenElem(cc, elem);
  return elem;
}

export const collectModule = collectElem(
  "module",
  (cc: CollectContext, openElem: PartElem<ModuleElem>) => {
    const ccComplete = { ...cc, start: 0, end: cc.src.length }; // force module to cover entire source despite ws skipping
    const moduleElem: ModuleElem = withTextCover(openElem, ccComplete);
    const weslState: StableState = cc.app.stable;
    weslState.moduleElem = moduleElem;
    return moduleElem;
  },
);

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

export const importElem = collectElem(
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

/** collect a scope start starts before and ends after a parser */
export function scopeCollect(): CollectPair<Scope> {
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

/** utility to collect an ElemWithContents
 * starts the new element as the collection point corresponding
 * to the start of the attached grammar and completes
 * the element in the at the end of the grammar.
 *
 * In between the start and the end, the new element is available
 * as an 'open' element in the collection context. While this element
 * is 'open', other collected are added to the 'contents' field of this
 * open element.
 */
function collectElem<V extends ElemWithContents>(
  kind: V["kind"],
  fn: (cc: CollectContext, partialElem: PartElem<V>) => V | null,
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
      if (elem) addToOpenElem(cc, elem as AbstractElem);
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
  const contents = coverWithText(cc, elem);
  return { ...elem, contents };
}

/** cover the entire source range with Elems by creating TextElems to
 * cover any parts of the source that are not covered by other elems
 * @returns the existing elems combined with any new TextElems, in src order */
function coverWithText(
  cc: CollectContext,
  elem: ElemWithContents,
): GrammarElem[] {
  let { start: pos } = cc;
  const ast: WeslAST = cc.app.stable;
  const { contents, end } = elem;
  const sorted = (contents as GrammarElem[]).sort((a, b) => a.start - b.start);

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

function collectLog(cc: CollectContext, ...messages: any[]): void {
  const { src, start, end } = cc;
  srcLog(src, [start, end], ...messages);
}
