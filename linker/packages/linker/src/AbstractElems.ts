import { ImportTree } from "./ImportTree.ts";
import { DeclIdent, RefIdent, SrcModule } from "./Scope.ts";

/** 
 * Structures to describe the 'interesting' parts of a WESL source file.
 *
 * The parts of the source that need to analyze further in the linker 
 * are pulled out into these structures.
 * 
 * The parts that are uninteresting the the linker are recorded
 * as 'TextElem' nodes, which are generally just copied to the output WGSL
 * along with their containing element.
 */
export type AbstractElem =
  | AliasElem
  | AttributeElem
  | ConstElem
  | ExpressionElem
  | ImportElem
  | ConstAssertElem
  | FnElem
  | RefIdentElem
  | DeclIdentElem
  | ModuleElem
  | NameElem
  | OverrideElem
  | ParamElem
  | StructElem
  | StructMemberElem
  | TextElem
  | TypeRefElem
  | GlobalVarElem
  | VarElem;

export type DeclarationElem =
  | AliasElem
  | ConstElem
  | OverrideElem
  | ParamElem
  | FnElem
  | StructElem
  | GlobalVarElem
  | VarElem;

export interface AbstractElemBase {
  kind: string;
  start: number;
  end: number;
}

export interface ElemWithContents extends AbstractElemBase {
  contents: AbstractElem[];
}

/** a raw bit of text in WESL source that's typically copied to the linked WGSL. 
 e.g. a keyword  like 'var' 
 or a phrase we needn't analyze further like '@diagnostic(off,derivative_uniformity)'
*/
export interface TextElem extends AbstractElemBase {
  kind: "text";
  srcModule: SrcModule;
}

export interface ImportElem extends ElemWithContents {
  kind: "import";
  imports: ImportTree;
}

export type TypeTemplateParameter = TypeRefElem | ExpressionElem | string;

/** an expression (generally we don't need details of expressions, just their contained idents */
export interface ExpressionElem extends ElemWithContents {
  kind: "expression";
}

/** a reference to a type, like 'f32', or 'MyStruct', or 'ptr<storage, array<f32>, read_only>'   */
export interface TypeRefElem extends ElemWithContents {
  kind: "type";
  name: RefIdent | string;
  templateParams?: TypeTemplateParameter[];
}

/** an identifier that refers to a declaration */
export interface RefIdentElem extends AbstractElemBase {
  kind: RefIdent["kind"];
  ident: RefIdent;
  srcModule: SrcModule;
}

/** a declaration identifier */
export interface DeclIdentElem extends AbstractElemBase {
  kind: DeclIdent["kind"];
  ident: DeclIdent;
  srcModule: SrcModule;
}

/** a parameter in a function declaration */
export interface ParamElem extends ElemWithContents {
  kind: "param";
  name: DeclIdentElem;
  typeRef: TypeRefElem;
}

/** an attribute like '@compute' or '@binding(0)' */
export interface AttributeElem extends ElemWithContents {
  kind: "attribute";
  name: string;
  params?: ExpressionElem[];
}

/** a variable declaration */
export interface VarElem extends ElemWithContents {
  kind: "var";
  name: DeclIdentElem;
  typeRef?: TypeRefElem;
}

/** a global variable declaration (at the root level) */
export interface GlobalVarElem extends ElemWithContents {
  kind: "gvar";
  name: DeclIdentElem;
  typeRef?: TypeRefElem;
}

/** a const declaration */
export interface ConstElem extends ElemWithContents {
  kind: "const";
  name: DeclIdentElem;
  typeRef?: TypeRefElem;
}

/** an override declaration */
export interface OverrideElem extends ElemWithContents {
  kind: "override";
  name: DeclIdentElem;
  typeRef?: TypeRefElem;
}

/** an entire file */
export interface ModuleElem extends ElemWithContents {
  kind: "module";
}

/** an alias statement */
export interface AliasElem extends ElemWithContents {
  kind: "alias";
  name: DeclIdentElem;
  typeRef: TypeRefElem;
}

/** a const_assert statement */
export interface ConstAssertElem extends ElemWithContents {
  kind: "assert";
}

/** a struct declaration */
export interface StructElem extends ElemWithContents {
  kind: "struct";
  name: DeclIdentElem;
  members: StructMemberElem[];
  bindingStruct?: true; // used later during binding struct transformation
}

/** a member of a struct declaration */
export interface StructMemberElem extends ElemWithContents {
  kind: "member";
  name: NameElem;
  attributes?: AttributeElem[];  
  typeRef: TypeRefElem;
}

/** a name (e.g. a struct member name) that doesn't need to be an Ident */
export interface NameElem extends AbstractElemBase {
  kind: "name";
  name: string;
  srcModule: SrcModule;
}

/** a function declaration */
export interface FnElem extends ElemWithContents {
  kind: "fn";
  name: DeclIdentElem;
  params: ParamElem[];
  returnType?: TypeRefElem;
}
