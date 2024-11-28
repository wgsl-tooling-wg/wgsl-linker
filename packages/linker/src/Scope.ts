import { pretty } from "berry-pretty";
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
  idents: Ident[]; // idents found in lexical order in this scope
  parent: Scope | null; // null for root scope in a module
  children: Scope[];
  kind: ScopeKind;
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
    logScope("scope not in rootScope", rootScope);
    logScope("..scope", rootScope);
  }

  // clone the current provisional scope with new ident added
  const scopeIdents = scope.idents;
  const idents: Ident[] = [...scopeIdents, ident];
  const newScope: Scope = { ...scope, idents };
  const newRootScope = cloneScopeReplace(rootScope, scope, newScope);

  return {
    scope: newScope,
    rootScope: newRootScope,
  };
}

/** @return a new root scope and new current scope with a child scope added to the current scope. */
export function withChildScope(
  rootScope: Scope,
  currentScope: Scope,
  newChildScope: Scope,
): RootAndScope {
  const newCurrentScope = {
    ...currentScope,
    children: [...currentScope.children, newChildScope],
  };
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

/** clone the rootScope, replacing oldScope with newScope in child and parent links */
function cloneScopeReplace(
  rootScope: Scope,
  oldScope: Scope,
  newScope: Scope,
): Scope {
  if (rootScope === oldScope) {
    return newScope;
  }

  const { kind, idents } = rootScope;
  const { parent: rootParent, children: rootChildren } = rootScope;
  const parent = rootParent === oldScope ? newScope : rootParent;
  const children = rootChildren.map(s =>
    cloneScopeReplace(s, oldScope, newScope),
  );
  return { kind, idents, parent, children };
}

export function logScope(message: string, scope: Scope) {
  console.log(`${message}:`);
  console.log(scopeToString(scope, 2));
}

export function scopeToString(scope: Scope, indent = 0): string {
  const { kind, idents, children } = scope;
  const identStr = pretty(idents.map(i => i.originalName));
  const childStrings = children.map(c => scopeToString(c, indent + 4));
  const childrenStr = childStrings.join("\n");
  const spc = " ".repeat(indent);
  // prettier-ignore
  return `${spc}${kind} ${identStr}\n` + 
         `${spc}  children:\n`+ 
         `${childrenStr}`;
}

// export interface ProvisionalScope {
//   currentScope: Scope; // current scope at this level of parsing
//   idents: Ident[]; // idents pending to add to current scope
//   scopes: Scope[]; // scopes pending to add to current scope

// }

// TODO do we need to bother with the tricky indexing to symbols?
// . two level table seems relevant for multithreading..
//   . also useful for say watch mode
//   . lets do it
// . and why do we need to use indices into the table vs pointers?
//   . if we want to replace a symbol we could just mutate it in place
//   . (esbuild claims its handy to clone the symbol table, so index references stay valid)
//   . lets skip it til we know we need it
// . and why do we need a single global symbol table to collect all the symbols
//   . scope tables seem sufficient..
//   . lets skip it til we know we need it
//
// let's build some stuff and find out..

/* 
Key tasks:
- accumulate idents and scopes during the parse
- bind idents references to declarations
- traverse AST from root module to emit
  - store idents in the AST? and references to AST from idents?
  - That would let us traverse the AST to find referenced AST elements
    - e.g. fn foo() { bar();} we need to traverse to bar()

Datastructures should be compatible for future parallelization:
- parse files in parallel
  - each file gets its own ident table
- presume ident binding is single threaded for now
  - esbuild is single threaded (according to arch diagram)
  - do any necessary ident mangling
  - works entirely on ident table
- emit code in parallel
  - 

*/

// export interface AllIdents {
//   tables: IdentTable[];   // idents for all tables
// }

// export interface IdentTable {
//   idents: Ident[][]; // indexed by moduleIndex and identIndex
// }

// // reference to a symbol in the Ident table, e.g. from an AST
// export interface IdentRef {
//   moduleIndex: number; // index of the file
//   identIndex: number; // index of the identifier within the file
// }
