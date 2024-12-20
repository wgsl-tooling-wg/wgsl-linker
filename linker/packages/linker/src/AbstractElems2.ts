import { DeclIdent, Ident, RefIdent } from "./Scope.ts";

export type AbstractElem2 =
  | AliasElem
  | ChunkElem
  | ConstElem
  | ConstAssertElem
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

type ChunkChild = ChunkElem | IdentElem | TextElem;

/** kn undifferentiated chunk of WESL source */
export interface ChunkElem extends AbstractElemBase2 {
  kind: "chunk";
  elems: ChunkChild[];
  conditions?: any; // TODO
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

/** a parameter in a function call */
export interface ParamElem extends AbstractElemBase2 {
  kind: "param";
  name: DeclIdent; // TODO IdentElem
  typeRef: RefIdent; // TODO IdentElem
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
export interface AliasElem extends ElemWithContents{
  kind: "alias";
  name: IdentElem;
  typeRef: IdentElem;
}

/** a const_assert statement */
export interface ConstAssertElem extends ElemWithContents {
  kind: "assert";
}

export interface StructElem extends ElemWithContents {
  kind: "struct";
  name: IdentElem;
  members: StructMemberElem[];
}

export interface StructMemberElem extends ElemWithContents {
  kind: "member";
  name: NameElem;
  typeRef: IdentElem;
}

/** a name (e.g. a struct member name) that doesn't need to be an Ident */
export interface NameElem extends AbstractElemBase2 {
  kind: "name",
  name: string;
  src: string; // TODO SrcModule
}