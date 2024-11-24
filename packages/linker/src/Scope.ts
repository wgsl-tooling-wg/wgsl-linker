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
  refersTo?: Ident | null;     // preceding ident in scope. null for decls, undefined before binding
  originalName: string; // name in the source code for ident matching (may be mangled in the output)
}

type ScopeKind = "fnBody" | "module";

/** tree of ident references, organized by lexical scope */
export interface Scope {
  symbolRefs: Ident[];  // idents found in lexical order in this scope
  parent: Scope;
  children: Scope[];
  kind: ScopeKind;
}

// TODO do we need to bother with the tricky indexing to symbols?
// . two level table seems only relevant for multithreading..
// . and why do we need to use indices into the table vs pointers?
//   . if we want to replace a symbol we could just mutate it in place
//   . (esbuild claims its handy to clone the symbol table, so index references stay valid)
// . and why do we need a single global symbol table to collect all the symbols
//   . scope tables seem sufficient..

// if we want to incrementally build, then I suppose the two level table would
// allow disposal of a file's worth of symbols from the global table
// . so I guess it'll depend on whether a global table is needed
//
// let's build some stuff and find out..
//


/* 
Key tasks:
- accumulate symbols and scopes during the parse
- allow for 
- bind symbols to referencences


Datastructures should be compatible for future parallelization:
- parse files in parallel
  - each file gets its own symbol table
- presume ident binding is single threaded for now
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
