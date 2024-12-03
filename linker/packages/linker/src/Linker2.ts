import { SrcMap, SrcMapBuilder } from "mini-parse";
import {
  AbstractElem,
  ChunkElem,
  IdentElem,
  TextElem,
} from "./AbstractElems.ts";
import { Conditions, DeclIdent, Ident, Scope } from "./Scope.ts";

/* --- Overview: Plan for Linking WESL --- */

/**
 * Link a set of WESL source modules (typically the text from .wesl files) into a single WGSL string.
 * Linking starts with a specified 'root' source module, and recursively incorporates code 
 * referenced from other modules (in local files or libraries). 
 * 
 * Unreferenced (dead) code outside the root module is not included in the output WGSL. 
 * Additionally the caller can specify conditions for to control conditional compilation. 
 * Only code that is valid with the current conditions is included in the output.
 *
 * @param weslSrc map of wesl source strings (aka modules) by scoped path
 *                key is '::' separated path .e.g `package::foo::bar.wesl`, value is wesl src
 *                (inludes both library and local WESL modules)
 * @param rootModuleName name or module path of the root module
 * @param conditions runtime conditions for conditional compilation
 */
export function linkWesl(
  weslSrc: Record<string, string>,
  rootModuleName: string = "main",
  conditions: Conditions = {},
): SrcMap {
  // parse all source modules in both app and libraries,
  // producing Scope tree and AST elements for each module
  const parsed: ParsedRegistry2 = parseWeslSrc(weslSrc);

  // get a reference to the root module
  const { rootScope, rootElems } = selectModule(rootModuleName, parsed);

  // link active Ident references to declarations, and uniquify global declarations
  // note this requires requires the Scope tree and Idents, but the AST is not needed
  bindIdents(rootScope, parsed, conditions);

  // traverse the AST and emit WGSL (doesn't need scopes)
  return lowerAndEmit(rootElems, parsed);
}

/* --- Step #1   Parsing WESL --- */

/**
 * Parse WESL each src module (file) into AST elements and a Scope tree. 
 *
 * @param src
 * @returns
 */
export function parseWeslSrc(src: Record<string, string>): ParsedRegistry2 {
  return null as any;
}

/* --- Step #2   Binding Idents --- */
/**
 * Bind active reference idents to declaration Idents by mutating the refersTo: field
 * Also in this pass, set the mangledName: field for all active global declaration idents.
 *
 * @param parsed
 * @param conditions  only bind to/from idents that are valid with the current condition set
 */
export function bindIdents(
  rootScope: Scope,
  parsed: ParsedRegistry2,
  conditions: Record<string, any>,
): void {
/* 
For each module's scope, search through the scope tree to find all ref idents
  - For each ref ident, search up the scope tree to find a matching decl ident
  - If no local match is found, check for partial matches with import statements
    - combine ident with import statement to match a decl in exporting module

As global decl idents are found, mutate their mangled name to be globally unique.
*/
}


/** return mangled name for decl ident, 
 *  mutating the Ident to remember mangled name if it hasn't yet been determined */
export function declUniqueName(
  decl: DeclIdent,
  rootNames: Set<string>,
): string {
  let { mangledName } = decl;

  if (!mangledName) {
    mangledName = uniquifyName(decl.originalName, rootNames);
    rootNames.add(mangledName);
    decl.mangledName = mangledName;
  }

  return mangledName;
}

/** construct global unique name for use in the output */
function uniquifyName(proposedName: string, rootNames: Set<string>): string {
  let renamed = proposedName;
  let conflicts = 0;

  // create a unique name
  while (rootNames.has(renamed)) {
    renamed = proposedName + conflicts++;
  }

  return renamed;
}

/* --- Step #3   Writing WGSL --- */

/** passed to the emitters */
interface EmitContext {
  rootNames: Set<string>; // names already emitted, mangle any new names that conflict
  srcMap: SrcMapBuilder;  // constructing the linked output
  conditions: Conditions; // settings for conditional compilation
}

/** traverse the AST, starting from root elements, emitting wgsl for each */
export function lowerAndEmit(
  rootElems: AbstractElem[],
  conditions: Conditions,
): SrcMap {
  const validElems = rootElems.filter(e => conditionsValid(e, conditions));
  const srcMap = new SrcMapBuilder();
  const emitContext: EmitContext = {
    rootNames: new Set(),
    conditions,
    srcMap,
  };
  validElems.map(e => lowerAndEmitElem(e, emitContext));

  return srcMap.build();
}

export function lowerAndEmitElem(
  e: AbstractElem,
  ctx: EmitContext,
): AbstractElem[] {
  switch (e.kind) {
    case "chunk":
      return lowerAndEmitChunk(e, ctx);
    case "text":
      return lowerAndEmitText(e, ctx);
    case "ident":
      return lowerAndEmitIdent(e, ctx);
    default:
      throw new Error(`NYI elem kind: ${e.kind}`);
  }
}

export function lowerAndEmitText(
  e: TextElem,
  ctx: EmitContext,
): AbstractElem[] {
  ctx.srcMap.add(e.src.src, e.start, e.end);
  return [];
}

export function lowerAndEmitChunk(
  e: ChunkElem,
  ctx: EmitContext,
): AbstractElem[] {
  const validElems = e.elems.filter(e => conditionsValid(e, ctx));
  return validElems.flatMap(e => lowerAndEmitElem(e, ctx));
}

export function lowerAndEmitIdent(
  e: IdentElem,
  ctx: EmitContext,
): AbstractElem[] {
  const declIdent = findDecl(e.ident);
  const mangledName = declIdent.mangledName!; // mangled name was set in binding step
  ctx.srcMap.add(mangledName, e.start, e.end);
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
  elem: AbstractElem,
  conditions: Conditions,
): boolean {
  return true;
}

/* ---- Utilities ---- */

interface ParsedModule {
  rootScope: Scope;
  rootElems: AbstractElem[]; // global elements in the module (fn, struct, var, etc.)
}

interface ParsedRegistry2 {
  modules: Record<string, ParsedModule>; // key is module path. "rand_pkg::foo::bar"
}


/** Look up a module by name or :: separated module path */
export function selectModule(
  name: string,
  parsed: ParsedRegistry2,
): ParsedModule {
  return null as any;
}


/* ---- Commentary on present and future features ---- */
/*

TODO 
- distinguish between global and local declaration idents (only global ones need be uniquified)

Binding Imports
- For each module scope, search through the scope tree to find all ref idents
  - For each ref ident, search up the scope tree to find a matching decl ident
  - If no local match is found, check for partial matches with import statements
    - combine with partially matched import statement to match decl in exporting module

Conditions
- conditions are attached to the AST elements where they are defined
  - only conditionally valid elements are emitted
- consolidated conditions are attached to Idents
  - only conditionally valid ref Idents are bound, and only to conditionaly valid declarations
  - a condition stack (akin to the scope stack) is maintained while parsing to attach consolidated conditions to Idents
- re-linking with new conditions, conservatively 
  - clear all mutated Ident fields (refersTo and mangled links) 
  - re-bind Idents, re-emit 

Generics & specialization
- attach generic parameters to ref and decl Idents, effectively creating a new Ident for each specialization
- generate specialized elements at emit time, by checking the generic parameters of the decl ident

Incrementally rebuilding
- unchanged files don't need to be reparsed, only reparse dirty files.
- support reflection only mode? no need to bind idents or emit for e.g. vite/IDE plugin generating reflection types 

Parallel Processing (coarse grained via webworkers)
- Parsing each module can be done in parallel
- binding could be done partially in parallel? (esbuild doesn't parallelize here though)
  - finding the declaration for each local ident could be done in parallel by module
  - matching 
- Emitting could be easily modified to be done in partially in parallel
  - traversing the AST to list the top level elements to emit could be done serially
  - the text for each top level element could be emitted in parallel (presumably the bulk of the work)
  - the merged text can be assembled serially

*/