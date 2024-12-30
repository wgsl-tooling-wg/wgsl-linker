import { ImportTree } from "./ImportTree.ts";
import { Ident } from "./Scope.ts";

export type AbstractElem2 =
  | AliasElem
  | ConstElem
  | ImportElem
  | ConstAssertElem
  | FnElem
  | IdentElem
  | ModuleElem
  | NameElem
  | OverrideElem
  | ParamElem
  | StructElem
  | StructMemberElem
  | TextElem
  | VarElem;

export interface AbstractElemBase2 {
  kind: string;
  start: number;
  end: number;
}

export interface ElemWithContents extends AbstractElemBase2 {
  contents: AbstractElem2[];
}

export interface ImportElem extends ElemWithContents {
  kind: "import";
  imports: ImportTree;
}

/** an identifier in WESL source */
export interface IdentElem extends AbstractElemBase2 {
  kind: "ident";
  ident: Ident;
  src: string; // TODO SrcModule
}

/** a raw bit of text in WESL source that's typically copied to the linked WGSL. 
 e.g. a keyword  like 'var' or '@diagnostic(off,derivative_uniformity)'
*/
export interface TextElem extends AbstractElemBase2 {
  kind: "text";
  src: string; // TODO SrcModule
}

/** a parameter in a function declaration */
export interface ParamElem extends ElemWithContents {
  kind: "param";
  name: IdentElem;
  typeRef: IdentElem;
}

/** a variable declaration */
export interface VarElem extends ElemWithContents {
  kind: "var";
  name: IdentElem;
  typeRef?: IdentElem;
}

/** a const declaration */
export interface ConstElem extends ElemWithContents {
  kind: "const";
  name: IdentElem;
  typeRef?: IdentElem;
}

/** an override declaration */
export interface OverrideElem extends ElemWithContents {
  kind: "override";
  name: IdentElem;
  typeRef?: IdentElem;
}

/** an entire file */
export interface ModuleElem extends ElemWithContents {
  kind: "module";
}

/** an alias statement */
export interface AliasElem extends ElemWithContents {
  kind: "alias";
  name: IdentElem;
  typeRef: IdentElem;
}

/** a const_assert statement */
export interface ConstAssertElem extends ElemWithContents {
  kind: "assert";
}

/** a struct declaration */
export interface StructElem extends ElemWithContents {
  kind: "struct";
  name: IdentElem;
  members: StructMemberElem[];
}

/** a member of a struct declaration */
export interface StructMemberElem extends ElemWithContents {
  kind: "member";
  name: NameElem;
  typeRef: IdentElem;
}

/** a name (e.g. a struct member name) that doesn't need to be an Ident */
export interface NameElem extends AbstractElemBase2 {
  kind: "name";
  name: string;
  src: string; // TODO SrcModule
}

/** a function declaration */
export interface FnElem extends ElemWithContents {
  kind: "fn";
  name: IdentElem;
  params: ParamElem[];
  returnType?: IdentElem;
}

// type ChunkChild = ChunkElem | IdentElem | TextElem;

// /** kn undifferentiated chunk of WESL source */
// export interface ChunkElem extends AbstractElemBase2 {
//   kind: "chunk";
//   elems: ChunkChild[];
//   conditions?: any; // TODO
// }
