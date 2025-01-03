import { SrcMapBuilder } from "mini-parse";
import {
  AbstractElem2,
  DeclIdentElem,
  IdentElem,
  NameElem,
  TextElem,
} from "./AbstractElems2.ts";
import { isGlobal } from "./BindIdents.ts";
import { Conditions, DeclIdent, Ident, RefIdent } from "./Scope.ts";
import { identToString } from "./ScopeLogging.ts";

/** passed to the emitters */
interface EmitContext {
  srcBuilder: SrcMapBuilder; // constructing the linked output
  conditions: Conditions; // settings for conditional compilation
  extracting: boolean; // are we extracting or copying the root module
}

/** traverse the AST, starting from root elements, emitting wgsl for each */
export function lowerAndEmit(
  srcBuilder: SrcMapBuilder,
  rootElems: AbstractElem2[],
  conditions: Conditions,
  extracting = true,
): void {
  const emitContext: EmitContext = { conditions, srcBuilder, extracting };
  lowerAndEmitRecursive(rootElems, emitContext);
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
    case "import":
      return; // drop imports statements from emitted text
    case "fn":
    case "struct":
    case "override":
    case "const":
    case "assert":
    case "gvar":
      if (ctx.extracting) {
        ctx.srcBuilder.addNl();
        ctx.srcBuilder.addNl();
      }
      return emitContents(e, ctx);
    case "text":
      return emitText(e, ctx);
    case "ref":
    case "decl":
      return emitIdent(e, ctx);
    case "param":
    case "var":
    case "module":
    case "alias":
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
  ctx.srcBuilder.addCopy(e.src, e.start, e.end);
}

export function emitName(e: NameElem, ctx: EmitContext): void {
  ctx.srcBuilder.add(e.name, e.src, e.start, e.end);
}

export function emitContents(
  elem: AbstractElem2 & { contents: AbstractElem2[] },
  ctx: EmitContext,
): void {
  elem.contents.forEach(e => lowerAndEmitElem(e, ctx));
}

export function emitIdent(
  e: IdentElem | DeclIdentElem,
  ctx: EmitContext,
): void {
  if ((e.ident as RefIdent).std) {
    ctx.srcBuilder.add(e.ident.originalName, e.src, e.start, e.end);
  } else {
    const declIdent = findDecl(e.ident);
    const mangledName = displayName(declIdent);
    ctx.srcBuilder.add(mangledName!, e.src, e.start, e.end);
  }
}

function displayName(declIdent: DeclIdent): string {
  if (declIdent.declElem && isGlobal(declIdent.declElem)) {
    // mangled name was set in binding step
    const mangledName = declIdent.mangledName;
    if (!mangledName) {
      // TODO wrap in 'debug' build time conditional
      console.log(
        "ERR: mangled name not found for decl ident",
        identToString(declIdent),
      );
    }
    return mangledName!;
  }

  return declIdent.mangledName || declIdent.originalName;
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

  throw new Error(
    `unresolved ident: ${ident.originalName} (bug in bindIdents?)`,
  );
}

/** check if the element is visible with the current current conditional compilation settings */
export function conditionsValid(
  elem: AbstractElem2,
  conditions: Conditions,
): boolean {
  return true;
}
