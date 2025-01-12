import { DeclarationElem, RefIdentElem } from "./AbstractElems.ts";
import { WeslAST } from "./ParseWESL.ts";

export interface SrcModule {
  /** module path "rand_pkg::sub::foo", or "package::main" */
  modulePath: string; // TODO drop this?

  /** file path to the module for user error reporting e.g "rand_pkg:sub/foo.wesl", or "./sub/foo.wesl" */
  filePath: string;

  /** original src for module */
  src: string;
}

/** a src declaration or reference to an ident */
export type Ident = DeclIdent | RefIdent;

export type Conditions = Record<string, boolean>;

interface IdentBase {
  originalName: string; // name in the source code for ident matching (may be mangled in the output)
  conditions?: Conditions; // conditions under which this ident is valid (combined from all containing elems)
  id?: number; // for debugging
}

export interface RefIdent extends IdentBase {
  kind: "ref";
  refersTo?: Ident; // import or decl ident in scope to which this ident refers. undefined before binding
  std?: true; // true if this is a standard wgsl identifier (like sin, or u32)
  ast: WeslAST; // AST from module that contains this ident (to find imports during decl binding)
  scope: Scope; // scope containing this reference (bind to decls starting from this scope)
  refIdentElem?: RefIdentElem; // for error reporting
}

export interface DeclIdent extends IdentBase {
  kind: "decl";
  mangledName?: string; // name in the output code
  declElem: DeclarationElem; // link to AST so that we can traverse scopes and know what elems to emit // TODO make separate GlobalDecl kind with this required
  scope: Scope; // scope for the references within this declaration
}

export type ScopeKind =
  | "module-scope" // root scope for a module (file)
  | "body-scope"; // a scope inside the module (fn body, nested block, etc.)

/** tree of ident references, organized by lexical scope */
export interface Scope {
  id?: number; // for debugging
  idents: Ident[]; // idents found in lexical order in this scope
  parent: Scope | null; // null for root scope in a module
  children: Scope[];
  kind: ScopeKind;
}

export function resetScopeIds() {
  // for debugging
  scopeId = 0;
}

let scopeId = 0; // for debugging

/** make a new Scope object */
export function makeScope(s: Omit<Scope, "id">): Scope {
  return { ...s, id: scopeId++ };
}

export interface RootAndScope {
  rootScope: Scope;
  scope: Scope;
}

export function emptyScope(kind: ScopeKind): Scope {
  return makeScope({ idents: [], parent: null, children: [], kind });
}

export function emptyBodyScope(parent: Scope): Scope {
  return makeScope({ kind: "body-scope", idents: [], parent, children: [] });
}

/** For debugging,
 * @return true if a scope is in the rootScope tree somewhere */
export function containsScope(rootScope: Scope, scope: Scope): boolean {
  if (scope === rootScope) {
    return true;
  }
  for (const child of rootScope.children) {
    if (containsScope(child, scope)) {
      return true;
    }
  }
  return false;
}

export function exportDecl(scope: Scope, name: string): DeclIdent | undefined {
  for (const ident of scope.idents) {
    if (ident.originalName === name && ident.kind === "decl") {
      return ident;
    }
  }
}
