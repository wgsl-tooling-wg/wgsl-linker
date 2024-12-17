import { ParsedRegistry2 } from "./ParsedRegistry2.ts";
import { DeclIdent, RefIdent, Scope } from "./Scope.ts";
import { stdFn, stdType } from "./TraverseRefs.ts";

/**
 * Bind active reference idents to declaration Idents by mutating the refersTo: field
 * Also in this pass, set the mangledName: field for all active global declaration idents.
 *
 * @param parsed
 * @param conditions  only bind to/from idents that are valid with the current condition set
 */
export function bindIdents(
  scope: Scope,
  parsed: ParsedRegistry2,
  conditions: Record<string, any>,
): void {
  /* 
For each module's scope, search through the scope tree to find all ref idents
  - For each ref ident, search up the scope tree to find a matching decl ident
  - If no local match is found, check for partial matches with import statements
    - combine ident with import statement to match a decl in exporting module

As global decl idents are found, mutate their mangled name to be globally unique.
*/
  scope.idents.forEach((ident, i) => {
    if (ident.kind === "ref") {
      if (stdWgsl(ident.originalName)) {
        ident.std = true;
      } else {
        const foundDecl = findDeclInModule(scope, ident, i) ?? findDeclImport();
        if (foundDecl) {
          ident.refersTo = foundDecl;

          if (!foundDecl.mangledName) {
            // TODO check for conflicts and actually mangle
            foundDecl.mangledName = foundDecl.originalName;
          }
        } else {
          // TODO log error with source position
          console.warn(`unresolved ident: ${ident.originalName}`);
        }
      }
    } else {
      if (!ident.mangledName) {
        ident.mangledName = ident.originalName;
      }
    }
  });
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

function findDeclImport(): DeclIdent | undefined {
  // TODO handle imports
  return undefined;
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
