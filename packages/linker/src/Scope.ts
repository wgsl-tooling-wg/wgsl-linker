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

type ScopeKind = "fnBody" | "module";

/** tree of ident references, organized by lexical scope */
export interface Scope {
  idents: Ident[]; // idents found in lexical order in this scope
  parent: Scope | null; // null for root scope in a module
  children: Scope[];
  kind: ScopeKind;
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
