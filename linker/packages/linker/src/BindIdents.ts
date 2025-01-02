import { dlog } from "berry-pretty";
import { DeclarationElem } from "./AbstractElems2.ts";
import { FlatImport } from "./FlattenTreeImport.ts";
import { ParsedRegistry2 } from "./ParsedRegistry2.ts";
import { DeclIdent, exportDecl, RefIdent, Scope } from "./Scope.ts";
import { stdFn, stdType } from "./TraverseRefs.ts";
import { last, overlapTail } from "./Util.ts";

/**
 * Bind active reference idents to declaration Idents by mutating the refersTo: field
 * Also in this pass, set the mangledName: field for all active global declaration idents.
 *
 * @param parsed
 * @param conditions  only bind to/from idents that are valid with the current condition set
 * @return any new declaration elements found (they will need to be emitted)
 */
export function bindIdents(
  scope: Scope,
  imports: FlatImport[],
  parsed: ParsedRegistry2,
  conditions: Record<string, any>,
): DeclarationElem[] {
  /* 
    For each module's scope, search through the scope tree to find all ref idents
      - For each ref ident, search up the scope tree to find a matching decl ident
      - If no local match is found, check for partial matches with import statements
        - combine ident with import statement to match a decl in exporting module

    As global decl idents are found, mutate their mangled name to be globally unique.
*/
  const knownDecls: Set<DeclIdent> = new Set();
  const foundScopes: Set<Scope> = new Set();
  const bindContext = { imports, parsed, conditions, knownDecls, foundScopes };
  const decls = bindIdentsRecursive(scope, bindContext);
  return decls.map(d => d.declElem);
}

interface BindContext {
  imports: FlatImport[];
  parsed: ParsedRegistry2;
  conditions: Record<string, any>;
  knownDecls: Set<DeclIdent>; // decl idents discovered so far
  foundScopes: Set<Scope>; // save work by not processing scopes multiple times
}

/**
 * Recursively bind references to declarations in this scope and
 * any child scopes referenced by these declarations.
 * Uses a hash set of found declarations to avoid duplication
 * @ return any new declarations found
 */
function bindIdentsRecursive(
  scope: Scope,
  bindContext: BindContext,
): DeclIdent[] {
  const { imports, parsed, conditions, knownDecls, foundScopes } = bindContext;
  if (foundScopes.has(scope)) return [];
  foundScopes.add(scope);

  const newDecls: DeclIdent[] = []; // queue of new decl idents to process
  scope.idents.forEach((ident, i) => {
    // dlog({ ident: ident.originalName, kind: ident.kind });
    if (ident.kind === "ref") {
      if (!ident.refersTo && !ident.std) {
        if (stdWgsl(ident.originalName)) {
          ident.std = true;
        } else {
          let foundDecl = findDeclInModule(scope, ident, i);
          if (!foundDecl) {
            foundDecl = findDeclImport(ident, imports, parsed);
            if (foundDecl && !knownDecls.has(foundDecl)) {
              knownDecls.add(foundDecl);
              newDecls.push(foundDecl);
            }
          }
          bindRefToDecl(ident, foundDecl, knownDecls);
        }
      }
    } else {
      if (!ident.mangledName) {
        // TODO use declUniqueName
        ident.mangledName = ident.originalName;
      }
    }
  });

  const newFromChildren = scope.children.flatMap(child =>
    bindIdentsRecursive(child, bindContext),
  );

  const newFromRefs = newDecls.flatMap(decl =>
    bindIdentsRecursive(decl.scope, bindContext));

  return [newDecls, newFromChildren, newFromRefs].flat();
}

function bindRefToDecl(
  ident: RefIdent,
  foundDecl: DeclIdent | undefined,
  knownDecls: Set<DeclIdent>,
) {
  if (foundDecl) {
    ident.refersTo = foundDecl;

    if (!foundDecl.mangledName) {
      // TODO check for conflicts and actually mangle
      const proposedName = ident.originalName;
      foundDecl.mangledName = proposedName;
    }
    knownDecls.add(foundDecl);
  } else {
    // TODO log error with source position
    console.log(`--- unresolved ident: ${ident.originalName}`);
  }
}

function stdWgsl(name: string): boolean {
  return stdType(name) || stdFn(name);
}

/** search earlier in the scope and in parent scopes to find a matching decl ident */
function findDeclInModule(
  scope: Scope,
  ident: RefIdent,
  identDex: number = scope.idents.length,
): DeclIdent | undefined {
  const { idents, parent } = scope;
  const { originalName } = ident;

  // see if the declaration is in this scope
  for (let i = identDex - 1; i >= 0; i--) {
    const checkIdent = idents[i];
    if (
      checkIdent.kind === "decl" &&
      originalName === checkIdent.originalName
    ) {
      return checkIdent;
    }
  }

  // recurse to check all idents in parent scope
  if (parent) {
    return findDeclInModule(parent, ident);
  }
}

/** Match a reference identifier to a declaration in
 * another module via an import statement */
function findDeclImport(
  ident: RefIdent,
  flatImports: FlatImport[],
  parsed: ParsedRegistry2,
): DeclIdent | undefined {
  // find module path by combining identifer reference with import statement
  const modulePathParts = matchingImport(ident, flatImports); // module path in array form

  if (modulePathParts) {
    return findExport(modulePathParts, parsed);
  }
}

/** using the flattened import array, find an import that matches a provided identifier */
function matchingImport(
  ident: RefIdent,
  flatImports: FlatImport[],
): string[] | undefined {
  const identParts = ident.originalName.split("::");
  for (const flat of flatImports) {
    const impTail = overlapTail(flat.importPath, identParts);
    if (impTail) {
      return [...flat.modulePath, ...impTail];
    }
  }
}

/** @return an exported root element for the provided path */
function findExport(
  modulePathParts: string[],
  parsed: ParsedRegistry2,
): DeclIdent | undefined {
  const legacyConvert = modulePathParts.map(p => (p === "." ? "package" : p)); // TODO rm after we update grammar
  const modulePath = legacyConvert.slice(0, -1).join("::");
  const module = parsed.modules[modulePath];
  if (!module) {
    console.log(
      `ident ${modulePathParts.join("::")} in import statement, but module not found`,
    );
  }

  return exportDecl(module.scope, last(modulePathParts)!);
}

/** return mangled name for decl ident,
 *  mutating the Ident to remember mangled name if it hasn't yet been determined */
export function declUniqueName(
  decl: DeclIdent,
  rootNames: Set<string>,
): string {
  let { mangledName } = decl;

  if (!mangledName) {
    mangledName = uniquifyName(decl.originalName, rootNames);
    rootNames.add(mangledName);
    decl.mangledName = mangledName;
  }

  return mangledName;
}

/** construct global unique name for use in the output */
function uniquifyName(proposedName: string, rootNames: Set<string>): string {
  let renamed = proposedName;
  let conflicts = 0;

  // create a unique name
  while (rootNames.has(renamed)) {
    renamed = proposedName + conflicts++;
  }

  return renamed;
}
