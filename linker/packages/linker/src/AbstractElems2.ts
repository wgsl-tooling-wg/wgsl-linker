import { DeclIdent, Ident, RefIdent, SrcModule } from "./Scope.ts";

export type AbstractElem2 =
  | ChunkElem
  | IdentElem
  | TextElem
  | ParamElem
  | ModuleElem
  | VarElem;

export interface AbstractElemBase2 {
  kind: string;
  start: number;
  end: number;
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
export interface VarElem extends AbstractElemBase2 {
  kind: "var";
  name: IdentElem;
  typeRef?: IdentElem;
  contents: AbstractElem2[];
}

export interface ModuleElem extends AbstractElemBase2 {
  kind: "module";
  contents: AbstractElem2[];
}
