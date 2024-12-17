import { SrcMap } from "mini-parse";
import { bindIdents } from "./BindIdents.ts";
import { lowerAndEmit } from "./LowerAndEmit.ts";
import {
  ParsedRegistry2,
  parseWeslSrc,
  selectModule,
} from "./ParsedRegistry2.ts";
import { Conditions } from "./Scope.ts";
import { scopeIdentTree } from "./ScopeLogging.ts";

/* --- Overview: Plan for Linking WESL --- */

/* 
This is a bit of a rework/reshuffling from the 'legacy' version described in Internals.md.

It expects the parser to identify three types of idents: 
  global declarations, local declarations, references
  (the legacy version distingished between type and variable idents, and more)

It tracks scopes, and keeps them independently from the AST. It uses the scopes trees for
binding references to declarations. (The legacy linker used combination
of naming tricks and AST traversal to bind references to declarations.)

Binding idents is more generic, which should simplify the code 
and extend more easily to for importing elements beyond structs and functions.

It asks less of the grammar, a complete WGSL grammar is easier to maintain 
if it can match the WGSL spec.

It replaces an AST pass with scope table pass, which should be a little faster. 

It's much more friendly to future parallel execution and incremental rebuilding, 
which should make things a lot faster when we go there.

The architecture allows conditional compilation from the AST rather than from the src text.

The AST is now immutable, mutation is confined to the Idents and Scopes. 
*/

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
  /* --- Step #1   Parsing WESL --- */
  // parse all source modules in both app and libraries,
  // producing Scope tree and AST elements for each module
  const parsed: ParsedRegistry2 = parseWeslSrc(weslSrc);

  // get a reference to the root module
  const found = selectModule(parsed, rootModuleName);
  if (!found) {
    throw new Error(`Root module not found: ${rootModuleName}`);
  }
  const { scope, elems2 } = found;
  
  // console.log(scopeIdentTree(scope));

  /* --- Step #2   Binding Idents --- */
  // link active Ident references to declarations, and uniquify global declarations
  // note this requires requires the Scope tree and Idents, but the AST is not needed
  bindIdents(scope, parsed, conditions);

  /* --- Step #3   Writing WGSL --- */
  // traverse the AST and emit WGSL (doesn't need scopes)
  return lowerAndEmit(elems2, parsed);
}

/* ---- Commentary on present and future features ---- */
/*

TODO 
- distinguish between global and local declaration idents (only global ones need be uniquified)

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
