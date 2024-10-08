/** Structures for the abstract syntax tree constructed by the parser. */

import { ImportTree } from "./ImportTree.js";
import { FoundRef } from "./TraverseRefs.js";

export type AbstractElem =
  | AliasElem
  | TreeImportElem
  | ExtendsElem
  | ExportElem
  | ModuleElem
  | TemplateElem
  | FnElem
  | GlobalDirectiveElem
  | TypeNameElem
  | FnNameElem
  | VarNameElem
  | CallElem
  | StructElem
  | StructMemberElem
  | VarElem
  | TypeRefElem;

export type NamedElem = Extract<AbstractElem, { name: string }>;

export interface AbstractElemBase {
  kind: string;
  start: number;
  end: number;
}

export interface CallElem extends AbstractElemBase {
  kind: "call";
  name: string;
  ref?: FoundRef;
}

export interface FnNameElem extends AbstractElemBase {
  kind: "fnName";
  name: string;
}

export interface VarNameElem extends AbstractElemBase {
  kind: "varName";
  name: string;
}

export interface FnElem extends AbstractElemBase {
  kind: "fn";
  name: string;
  nameElem: FnNameElem;
  calls: CallElem[];
  typeRefs: TypeRefElem[];
}

export interface TypeRefElem extends AbstractElemBase {
  kind: "typeRef";
  name: string;
  ref?: FoundRef;
}

export interface TypeNameElem extends AbstractElemBase {
  kind: "typeName";
  name: string;
}

export interface StructElem extends AbstractElemBase {
  kind: "struct";
  name: string;
  nameElem: TypeNameElem;
  members: StructMemberElem[];
  extendsElems?: ExtendsElem[];
}

export interface StructMemberElem extends AbstractElemBase {
  kind: "member";
  name: string;
  typeRefs: TypeRefElem[];
}

export interface ExportElem extends AbstractElemBase {
  kind: "export";
  args?: string[];
  importing?: any[]; // TODO
}

// LATER consider modeling import elems as containing multiple clauses 
// instead of overlapping ImportElems 

export interface TreeImportElem extends AbstractElemBase {
  kind: "treeImport";
  imports: ImportTree;
}


export interface ExtendsElem extends AbstractElemBase {
  kind: "extends";
  name: string;
  args?: string[];
  as?: string;
  from?: string;
}

export interface ModuleElem extends AbstractElemBase {
  kind: "module";
  name: string;
}

export interface VarElem extends AbstractElemBase {
  kind: "var";
  name: string;
  nameElem: VarNameElem;
  typeRefs: TypeRefElem[];
}

export interface TemplateElem extends AbstractElemBase {
  kind: "template";
  name: string;
}

export interface AliasElem extends AbstractElemBase {
  kind: "alias";
  name: string;
  targetName: string;
  typeRefs: TypeRefElem[];
}

/** global directive (diagnostic, enable, requires) or const_assert */
export interface GlobalDirectiveElem extends AbstractElemBase {
  kind: "globalDirective";
}