import { dlog, pretty } from "berry-pretty";
import { tracing } from "mini-parse";

type IdentKind = "decl" | "ref";

export interface SrcModule {
  /** full path to the module e.g "package/sub/foo", or "_root/sub/foo" */
  modulePath: string;

  /** original src for module */
  src: string;
}

export interface SrcLoc {
  pos: number;
  src: SrcModule;
}

/** a src declaration or  */
export interface Ident {
  kind: IdentKind;
  refersTo?: Ident | null; // preceding ident in scope. null for decls, undefined before binding
  originalName: string; // name in the source code for ident matching (may be mangled in the output)
}

export type ScopeKind =
  | "module" // root scope for a module (file)
  | "body"; // a scope inside the module (fn body, nested block, etc.)

/** tree of ident references, organized by lexical scope */
export interface Scope {
  id?: number; // for debugging
  idents: Ident[]; // idents found in lexical order in this scope
  parent: Scope | null; // null for root scope in a module
  children: Scope[];
  kind: ScopeKind;
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

/** @return a new root scope and new current scope with an ident added to the current scope. */
export function withAddedIdent(
  rootScope: Scope,
  scope: Scope,
  ident: Ident,
): RootAndScope {
  if (tracing && !containsScope(rootScope, scope)) {
    logScope(
      `withAddedIndent '${ident.originalName}'. current scope #${scope.id} not in rootScope: #${rootScope.id}`,
      rootScope,
    );
    logScope("..scope", scope);
  }

  // clone the current provisional scope with new ident added
  const scopeIdents = scope.idents;
  const idents: Ident[] = [...scopeIdents, ident];
  const newScope = makeScope({ ...scope, idents });
  const newRootScope = cloneScopeReplace(rootScope, scope, newScope);

  return {
    scope: newScope,
    rootScope: newRootScope,
  };
}

function emptyScope(kind: ScopeKind): Scope {
  return makeScope({ idents: [], parent: null, children: [], kind });
}

/** @return
 *    . a new root scope with a child scope added to the current scope.
 *    . the new current scope is the new child scope
 */
export function withChildScope(
  rootScope: Scope,
  currentScope: Scope,
  kind: ScopeKind,
): RootAndScope {
  const newChildScope = emptyScope(kind);
  const newCurrentScope = makeScope({
    ...currentScope,
    children: [...currentScope.children, newChildScope],
  });
  newChildScope.parent = newCurrentScope;
  const newRootScope = cloneScopeReplace(
    rootScope,
    currentScope,
    newCurrentScope,
  );

  return {
    scope: newChildScope,
    rootScope: newRootScope,
  };
}

/** For debugging,
 * @return true if a scope is in the rootScope tree somewhere */
function containsScope(rootScope: Scope, scope: Scope): boolean {
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

/** @return a new rootScope,
 *    replacing oldScope with newScope in child and parent links */
function cloneScopeReplace(
  rootScope: Scope,
  oldScope: Scope,
  newScope: Scope,
): Scope {
  if (rootScope === oldScope) {
    return newScope;
  }

  const { kind, idents } = rootScope;
  const { parent: origRootParent, children: rootChildren } = rootScope;
  const newRootParent = origRootParent === oldScope ? newScope : origRootParent;
  const children = [] as Scope[];
  const newRoot = makeScope({ kind, idents, parent: newRootParent, children });

  const newChildren = rootChildren.map(child =>
    cloneScopeReplace(child, oldScope, newScope),
  );
  newChildren.map(c => (c.parent = newRoot));
  newRoot.children = newChildren;

  return newRoot;
}

export function logScope(message: string, scope: Scope) {
  console.log(`${message}:`);
  console.log(scopeToString(scope, 2));
}

export function scopeToString(scope: Scope, indent = 0): string {
  const { children, parent } = scope;
  const childStrings = children.map(c => scopeToString(c, indent + 4));
  const childrenStr = childStrings.join("\n");
  const spc = " ".repeat(indent);
  // prettier-ignore
  return `${spc}${scopeHeader(scope)}\n` + 
         `${spc}  parent: ${scopeHeader(parent)}\n` +
         `${spc}  children:\n`+ 
         `${childrenStr}`;
}

function scopeHeader(scope: Scope | undefined | null): string {
  if (scope === undefined) {
    return "undefined";
  }
  if (scope === null) {
    return "null";
  }

  const { kind, idents, id } = scope;
  const identStr = pretty(idents.map(i => i.originalName));
  const idStr = "id: " + id === undefined ? "?" : id;
  return `#${idStr} ${kind} ${identStr}`;
}