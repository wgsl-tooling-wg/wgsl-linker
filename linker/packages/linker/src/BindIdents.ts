import { debugNames } from "mini-parse";
import { DeclarationElem } from "./AbstractElems2.ts";
import { FlatImport } from "./FlattenTreeImport.ts";
import { ParsedRegistry2 } from "./ParsedRegistry2.ts";
import { DeclIdent, exportDecl, RefIdent, Scope } from "./Scope.ts";
import { identToString, scopeIdentTree } from "./ScopeLogging.ts";
import { stdFn, stdType } from "./TraverseRefs.ts";
import { last, overlapTail } from "./Util.ts";
import { dlog } from "berry-pretty";
import { flatImports, WeslAST } from "./ParseWESL.ts";

/**
 * Bind active reference idents to declaration Idents by mutating the refersTo: field
 * Also in this pass, set the mangledName: field for all active global declaration idents.
 *
 * @param parsed
 * @param conditions  only bind to/from idents that are valid with the current condition set
 * @return any new declaration elements found (they will need to be emitted)
 */
export function bindIdents(
  ast: WeslAST,
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
  const { rootScope } = ast;

  const globalNames = new Set<string>();
  const knownDecls = new Set<DeclIdent>();
  rootScope.idents.forEach(ident => {
    if (ident.kind === "decl") {
      ident.mangledName = ident.originalName;
      globalNames.add(ident.originalName);
      knownDecls.add(ident);
    }
  });

  const bindContext = {
    parsed,
    conditions,
    knownDecls,
    foundScopes: new Set<Scope>(),
    globalNames,
  };
  const decls = bindIdentsRecursive(rootScope, bindContext);
  return decls.flatMap(d =>
    d.declElem && isGlobal(d.declElem) ? [d.declElem] : [],
  );
}

interface BindContext {
  parsed: ParsedRegistry2;
  conditions: Record<string, any>;
  knownDecls: Set<DeclIdent>; // decl idents discovered so far
  foundScopes: Set<Scope>; // save work by not processing scopes multiple times
  globalNames: Set<string>; // root level names  used so far
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
  // early exist if we've processed this scope before
  const { foundScopes } = bindContext;
  if (foundScopes.has(scope)) return [];
  foundScopes.add(scope);

  // dlog(scopeIdentTree(scope));

  const { parsed, conditions } = bindContext;
  const { globalNames, knownDecls } = bindContext;
  const newDecls: DeclIdent[] = []; // new decl idents to process (and return)

  scope.idents.forEach((ident, i) => {
    // dlog(`--- considering ident ${identToString(ident)}`);
    if (ident.kind === "ref") {
      if (!ident.refersTo && !ident.std) {
        if (stdWgsl(ident.originalName)) {
          ident.std = true;
        } else {
          let foundDecl =
            findDeclInModule(scope, ident, i) ?? findDeclImport(ident, parsed);

          if (foundDecl && !knownDecls.has(foundDecl)) {
            // dlog(
            //   `  > found decl: ${identToString(foundDecl)} known: ${knownDecls.has(foundDecl)}`,
            // );
            setDisplayName(ident.originalName, foundDecl, globalNames);
            // dlog(`  > queuing new decl: ${identToString(foundDecl)}`);
            if (foundDecl.declElem && isGlobal(foundDecl.declElem)) {
              newDecls.push(foundDecl);
            }
            knownDecls.add(foundDecl);
          }
          bindRefToDecl(ident, foundDecl, knownDecls);
        }
      }
    }
  });

  // follow references from child scopes
  const newFromChildren = scope.children.flatMap(child => {
    // dlog("newFromChildren", { childScope: scopeIdentTree(child) });
    return bindIdentsRecursive(child, bindContext);
  });
  // console.log(
  //   "new from children",
  //   newFromChildren.map(d => identToString(d)),
  // );

  // follow references from referenced declarations
  const newFromRefs = newDecls.flatMap(decl => {
    // dlog("newFromRefs", {
    //   decl: identToString(decl),
    //   declScope: scopeIdentTree(decl.scope),
    // });
    if (debugNames && !decl.scope) {
      console.log(`--- decl ${identToString(decl)} has no scope`);
      return [];
    }
    return bindIdentsRecursive(decl.scope, bindContext);
  });
  // console.log(
  //   "new from refs",
  //   newFromRefs.map(d => identToString(d)),
  // );

  return [newDecls, newFromChildren, newFromRefs].flat();
}

function setDisplayName(
  proposedName: string,
  decl: DeclIdent,
  globalNames: Set<string>,
): void {
  if (!decl.mangledName) {
    // if (!decl.declElem) {
    //   console.log(
    //     `--- decl ident ${identToString(decl)} has no declElem attached`,)
    // } else
    if (decl.declElem && isGlobal(decl.declElem)) {
      decl.mangledName = declUniqueName(proposedName, globalNames);
      // dlog(`  > mangle global decl: ${identToString(decl)}`);
    } else {
      // dlog(`  > no-mangle local decl: ${identToString(decl)}`);
      decl.mangledName = decl.originalName;
    }
  }
}

function bindRefToDecl(
  ident: RefIdent,
  foundDecl: DeclIdent | undefined,
  knownDecls: Set<DeclIdent>,
) {
  // dlog({ ident: identToString(ident), foundDecl: identToString(foundDecl) });
  if (foundDecl) {
    ident.refersTo = foundDecl;

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

  // dlog(`  |> findDeclInModule ${originalName}`);
  // see if the declaration is in this scope
  for (let i = identDex - 1; i >= 0; i--) {
    const checkIdent = idents[i];
    const { kind } = checkIdent;
    if (kind === "decl" && originalName === checkIdent.originalName) {
      // dlog(`  |> found decl in scope: ${identToString(checkIdent)}`);
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
  refIdent: RefIdent,
  parsed: ParsedRegistry2,
): DeclIdent | undefined {
  // dlog(identToString(refIdent), { ast: !!refIdent.ast });
  const flatImps = flatImports(refIdent.ast);

  // find module path by combining identifer reference with import statement
  const modulePathParts = matchingImport(refIdent, flatImps); // module path in array form

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

  return exportDecl(module.rootScope, last(modulePathParts)!);
}

/** return mangled name for decl ident,
 *  mutating the Ident to remember mangled name if it hasn't yet been determined */
export function declUniqueName(
  proposedName: string,
  rootNames: Set<string>,
): string {
  const displayName = uniquifyName(proposedName, rootNames);
  rootNames.add(displayName);

  return displayName;
}

/** construct global unique name for use in the output */
function uniquifyName(proposedName: string, rootNames: Set<string>): string {
  let renamed = proposedName;
  let conflicts = 0;

  // create a unique name
  while (rootNames.has(renamed)) {
    renamed = proposedName + conflicts++;
  }

  // dlog({ proposedName, renamed });
  return renamed;
}

export function isGlobal(elem: DeclarationElem): boolean {
  return ["alias", "const", "override", "fn", "struct", "gvar"].includes(
    elem.kind,
  );
}
