import { dlog } from "berry-pretty";
import { SrcMap, SrcMapBuilder } from "mini-parse";
import {
  AbstractElem2,
  IdentElem,
  NameElem,
  TextElem,
} from "./AbstractElems2.ts";
import { Conditions, DeclIdent, Ident, RefIdent } from "./Scope.ts";

/** passed to the emitters */
interface EmitContext {
  srcMap: SrcMapBuilder; // constructing the linked output
  conditions: Conditions; // settings for conditional compilation
}

/** traverse the AST, starting from root elements, emitting wgsl for each */
export function lowerAndEmit(
  rootElems: AbstractElem2[],
  conditions: Conditions,
): SrcMap {
  const srcMap = new SrcMapBuilder();
  const emitContext: EmitContext = { conditions, srcMap };
  lowerAndEmitRecursive(rootElems, emitContext);
  return srcMap.build();
}

function lowerAndEmitRecursive(
  elems: AbstractElem2[],
  emitContext: EmitContext,
): void {
  const validElems = elems.filter(e =>
    conditionsValid(e, emitContext.conditions),
  );
  validElems.forEach(e => lowerAndEmitElem(e, emitContext));
}

export function lowerAndEmitElem(e: AbstractElem2, ctx: EmitContext): void {
  switch (e.kind) {
    case "text":
      return emitText(e, ctx);
    case "ident":
      return emitIdent(e, ctx);
    case "fn":
    case "param":
    case "var":
    case "module":
    case "alias":
    case "override":
    case "const":
    case "assert":
    case "struct":
    case "member":
      return emitContents(e, ctx);
    case "name":
      return emitName(e, ctx);
    default:
      const kind = (e as any).kind;
      console.log("NYI for emit, elem kind:", kind);
      throw new Error(`NYI emit elem kind: ${kind}`);
  }
}

export function emitText(e: TextElem, ctx: EmitContext): void {
  ctx.srcMap.addCopy(e.src, e.start, e.end);
}

export function emitName(e: NameElem, ctx: EmitContext): void {
  ctx.srcMap.add(e.name, e.src, e.start, e.end);
}

export function emitContents(
  elem: AbstractElem2 & { contents: AbstractElem2[] },
  ctx: EmitContext,
): void {
  elem.contents.forEach(e => lowerAndEmitElem(e, ctx));
}

export function emitIdent(e: IdentElem, ctx: EmitContext): void {
  if ((e.ident as RefIdent).std) {
    ctx.srcMap.add(e.ident.originalName, e.src, e.start, e.end);
  } else {
    const declIdent = findDecl(e.ident);
    const mangledName = declIdent.mangledName!; // mangled name was set in binding step
    ctx.srcMap.add(mangledName, e.src, e.start, e.end);
  }
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

  throw new Error(`unresolved ident: ${ident.originalName}`);
}

/** check if the element is visible with the current current conditional compilation settings */
export function conditionsValid(
  elem: AbstractElem2,
  conditions: Conditions,
): boolean {
  return true;
}
