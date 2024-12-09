import { SrcMap, SrcMapBuilder } from "mini-parse";
import {
  AbstractElem2,
  ChunkElem,
  IdentElem,
  ModuleElem,
  TextElem,
  VarElem,
} from "./AbstractElems2.ts";
import { Conditions, DeclIdent, Ident, RefIdent } from "./Scope.ts";

/** passed to the emitters */
interface EmitContext {
  rootNames: Set<string>; // names already emitted, mangle any new names that conflict
  srcMap: SrcMapBuilder; // constructing the linked output
  conditions: Conditions; // settings for conditional compilation
}

/** traverse the AST, starting from root elements, emitting wgsl for each */
export function lowerAndEmit(
  rootElems: AbstractElem2[],
  conditions: Conditions,
): SrcMap {
  const validElems = rootElems.filter(e => conditionsValid(e, conditions));
  const srcMap = new SrcMapBuilder();
  const emitContext: EmitContext = {
    rootNames: new Set(),
    conditions,
    srcMap,
  };

  for (let elems = validElems; elems.length; ) {
    elems = elems.flatMap(e => lowerAndEmitElem(e, emitContext));
  }

  return srcMap.build();
}

export function lowerAndEmitElem(
  e: AbstractElem2,
  ctx: EmitContext,
): AbstractElem2[] {
  // dlog("lowerAndEmitElem", { kind: e.kind });
  switch (e.kind) {
    case "chunk":
      return lowerAndEmitChunk(e, ctx);
    case "text":
      return lowerAndEmitText(e, ctx);
    case "var":
      return lowerAndEmitVar(e, ctx);
    case "ident":
      return lowerAndEmitIdent(e, ctx);
    case "module":
      return lowerAndEmitModule(e, ctx);
    default:
      throw new Error(`NYI emit elem kind: ${e.kind}`);
  }
}

export function lowerAndEmitText(
  e: TextElem,
  ctx: EmitContext,
): AbstractElem2[] {
  ctx.srcMap.addCopy(e.src, e.start, e.end);
  return [];
}

export function lowerAndEmitModule(
  elem: ModuleElem,
  ctx: EmitContext,
): AbstractElem2[] {
  return elem.contents;
}

export function lowerAndEmitVar(
  elem: VarElem,
  ctx: EmitContext,
): AbstractElem2[] {
  return elem.contents;
}

export function lowerAndEmitChunk(
  e: ChunkElem,
  ctx: EmitContext,
): AbstractElem2[] {
  const validElems = e.elems.filter(e => conditionsValid(e, ctx));
  return validElems.flatMap(e => lowerAndEmitElem(e, ctx));
}

export function lowerAndEmitIdent(
  e: IdentElem,
  ctx: EmitContext,
): AbstractElem2[] {
  if ((e.ident as RefIdent).std) {
    ctx.srcMap.add(e.ident.originalName, e.src, e.start, e.end);
  } else {
    const declIdent = findDecl(e.ident);
    const mangledName = declIdent.mangledName!; // mangled name was set in binding step
    ctx.srcMap.add(mangledName, e.src, e.start, e.end);
  }
  return [];
}

/** trace through refersTo links in reference Idents until we find the declaration
 * expects that bindIdents has filled in all refersTo: links
 */
export function findDecl(ident: Ident): DeclIdent {
  let i: Ident | undefined = ident;
  do {
    if (i.kind === "decl") {
      return i;
    }
    i = i.refersTo;
  } while (i);

  throw new Error(`unresolved ident: ${ident}`);
}

/** check if the element is visible with the current current conditional compilation settings */
export function conditionsValid(
  elem: AbstractElem2,
  conditions: Conditions,
): boolean {
  return true;
}
