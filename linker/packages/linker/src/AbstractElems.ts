/** Structures for the abstract syntax tree constructed by the parser. */

import { ImportTree } from "./ImportTree.js";
import { DeclIdent, Ident, RefIdent, SrcModule } from "./Scope.js";
import { FoundRef } from "./TraverseRefs.js";

export type AbstractElem =
  | AliasElem
  | TreeImportElem
  | ExportElem
  | ModuleElem
  | FnElem
  | GlobalDirectiveElem
  | TypeNameElem
  | FnNameElem
  | VarNameElem
  | CallElem
  | StructElem
  | StructMemberElem
  | ChunkElem
  | IdentElem
  | TextElem
  | VarElem
  | TypeRefElem;

export type NamedElem = Extract<AbstractElem, { name: string }>;

export interface AbstractElemBase {
  kind: string;
  start: number;
  end: number;
}

// legacy, to be removed
export interface CallElem extends AbstractElemBase {
  kind: "call";
  name: string;
  ref?: FoundRef;
}

// legacy, to be removed
export interface FnNameElem extends AbstractElemBase {
  kind: "fnName";
  name: string;
}

// legacy, to be removed
export interface VarNameElem extends AbstractElemBase {
  kind: "varName";
  name: string;
}

export interface FnElem extends AbstractElemBase {
  kind: "fn";
  name: string; // change to Ident?
  nameElem: FnNameElem; // legacy, to be removed
  calls: CallElem[]; // legacy, to be removed
  typeRefs: TypeRefElem[]; // legacy, to be removed
  elems?: ChildElemType[];
}

// legacy, to be removed
export interface TypeRefElem extends AbstractElemBase {
  kind: "typeRef";
  name: string;
  ref?: FoundRef;
}

// legacy, to be removed
export interface TypeNameElem extends AbstractElemBase {
  kind: "typeName";
  name: string;
}

export interface StructElem extends AbstractElemBase {
  kind: "struct";
  name: string; // change to Ident?
  nameElem: TypeNameElem; // legacy, to be removed
  members: StructMemberElem[];
}

export interface StructMemberElem extends AbstractElemBase {
  kind: "member";
  name: string; 
  typeRefs: TypeRefElem[]; // change to RefIdent
}

// legacy, to be removed
export interface ExportElem extends AbstractElemBase {
  kind: "export";
  args?: string[];
}

// LATER consider modeling import elems as containing multiple clauses
// instead of overlapping ImportElems

export interface TreeImportElem extends AbstractElemBase {
  kind: "treeImport";
  imports: ImportTree;
}

// legacy support for the 'module' directive
export interface ModuleElem extends AbstractElemBase {
  kind: "module";
  name: string;
}

export interface VarElem extends AbstractElemBase {
  kind: "var";
  name: string; // change to DeclIdent?
  nameElem: VarNameElem; // legacy, remove
  typeRefs: TypeRefElem[]; // change to RefIdent
}

export interface AliasElem extends AbstractElemBase {
  kind: "alias";
  name: string; // change to DeclIdent?
  targetName: string; // change to RefIdent?
  typeRefs: TypeRefElem[]; // legacy, remove
}

/** global directive (diagnostic, enable, requires) or const_assert */
export interface GlobalDirectiveElem extends AbstractElemBase {
  kind: "globalDirective";
}

/** an element that may be inside another element */
export type ChildElemType = ChunkElem | IdentElem | TextElem;

// an undifferentiated chunk of WESL source, contains other chunks and idents
export interface ChunkElem extends AbstractElemBase {
  kind: "chunk";
  elems: ChildElemType[];
  conditions?: any; // TBD
}

// an identifier in WESL source
export interface IdentElem extends AbstractElemBase {
  kind: "ident";
  ident: Ident;
}

/** a raw bit of text in WESL source that's typically copied to the linked WGSL. 
 e.g. a keyword  like 'var' or '@diagnostic(off,derivative_uniformity)'
*/
export interface TextElem extends AbstractElemBase {
  kind: "text";
  src: SrcModule; // TODO move to abstract elem base?
}

/** a parameter in a function call */
export interface ParamElem extends AbstractElemBase{
  kind: "param";
  name: DeclIdent;
  type: RefIdent;
}