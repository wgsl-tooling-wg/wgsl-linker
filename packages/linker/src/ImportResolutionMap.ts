import { ExportElem, TreeImportElem } from "./AbstractElems.js";
import {
  ImportTree,
  PathSegment,
  SegmentList,
  SimpleSegment,
  Wildcard,
} from "./ImportTree.js";
import { moduleLog } from "./LinkerLogging.js";
import {
  GeneratorExport,
  GeneratorModule,
  ModuleExport,
} from "./ModuleRegistry.js";
import { exportName, ParsedRegistry } from "./ParsedRegistry.js";
import { TextModule } from "./ParseModule.js";
import { dirname, normalize } from "./PathUtil.js";
import { StringPairs } from "./TraverseRefs.js";

/**
 * Maps to resolve imports to exports.
 *
 * We could be bringing two different things into scope when we import mymod::foo
 * 1) an exported function, used as foo()
 * 2) a module path, used as foo::bar()  (or foo.bar())
 *
 * Two maps are provided:
 *  . from (caller) import path to export path (taking into account 'import as' renaming)
 *  . from export path to exported wgsl element
 *
 * For module paths that don't resolve immediately to a wgsl element,
 * we expect to resolve them to wgsl elements later when combined with
 * a reference site suffix, e.g.:
 *    import pkg::a as b      // pkg::b -> pkg::a     map import path to export path
 *    fn foo() { b::bar(); }  // can now resolve to exported element pkg::a::bar
 */
export interface ResolveMap {
  // map from caller path to exporter path ["pkg", "subpath", "asName"] -> "mypkg/subpath/expName"
  // import params are appended to the export path "mypkg/foo/exp(X)" so that paths are unique for generics
  pathsMap: Array<[string[], string]>;

  // map from export path string "mypkg/foo/exp" to resolved export
  // import params are appended to the export path: "mypkg/foo/exp(X)" so that paths are unique for generics
  exportMap: Map<string, ExportPathToExport>;
}

/*
 * Flattening wildcards and segment lists,
 * and resolve paths that refer to exported elements
 *
 * These entries will be converted into a ResolveMap
 */
type ResolvedEntry = ExportPathToExport | ImportToExportPath;
class ExportPathToExport {
  constructor(
    public exportPath: string,
    public modExp: ModuleExport,
    public expImpArgs: StringPairs,
  ) {}
}

class ImportToExportPath {
  constructor(
    public importPath: string[],
    public exportPath: string,
  ) {}
}

/** Expand all imports paths to their corresponding export paths
 * and from the export path to the exported element (fn, struct var) if possible.
 *
 * Wildcards and path lists are fully expanded.
 *
 * @returns a ResolveMap
 */
export function importResolutionMap(
  importingModule: TextModule,
  imports: TreeImportElem[],
  registry: ParsedRegistry,
): ResolveMap {
  const resolveEntries = imports.flatMap(imp =>
    resolveTreeImport(importingModule, imp, registry),
  );

  const exportEntries: [string, ExportPathToExport][] = [];
  const pathEntries: [string[], string][] = [];

  resolveEntries.forEach(e => {
    if (e instanceof ExportPathToExport) {
      exportEntries.push([e.exportPath, e]);
    } else {
      pathEntries.push([e.importPath, e.exportPath]);
    }
  });

  return {
    exportMap: new Map(exportEntries),
    pathsMap: pathEntries,
  };
}

/** @return flattened list of resolved import paths including
 * resolved exports (for fully specified export paths)
 */
function resolveTreeImport(
  importingModule: TextModule,
  imp: TreeImportElem,
  registry: ParsedRegistry,
): ResolvedEntry[] {
  return recursiveResolve([], [], imp.imports.segments);

  /** recurse through segments of path, producing  */
  function recursiveResolve(
    resolvedImportPath: string[],
    resolvedExportPath: string[],
    remainingPath: PathSegment[],
  ): ResolvedEntry[] {
    const [segment, ...rest] = remainingPath;
    if (segment === undefined) {
      throw new Error(`undefined segment ${imp.imports.segments}`);
    }
    if (segment instanceof SimpleSegment) {
      const impPath = [...resolvedImportPath, segment.as || segment.name];
      const expPath = [...resolvedExportPath, segment.name];
      if (rest.length) {
        // we're in the middle of the path so keep recursing
        return recursiveResolve(impPath, expPath, rest);
      } else {
        return resolveFlatPath(impPath, expPath, segment.args);
      }
    }
    if (segment instanceof SegmentList) {
      // resolve path with each element in the list
      return segment.list.flatMap(elem => {
        const rPath = [elem, ...rest];
        return recursiveResolve(resolvedImportPath, resolvedExportPath, rPath);
      });
    }
    if (segment instanceof Wildcard) {
      const modulePath = resolvedExportPath.join("/");
      const m = registry.findModule(modulePath);
      if (m) {
        return wildCardExports(m, resolvedImportPath, resolvedExportPath);
      } else {
        console.error("no module found", modulePath); // LATER point to source location in error
      }
      return [];
    } else if (segment instanceof ImportTree) {
      return recursiveResolve(
        resolvedImportPath,
        resolvedExportPath,
        segment.segments,
      );
    }

    console.error("unknown segment type", segment); // should be impossible
    return [];
  }

  function wildCardExports(
    m: GeneratorModule | TextModule,
    resolvedImportPath: string[],
    resolvedExportPath: string[],
  ): ResolvedEntry[] {
    const exportKind = m.kind === "generator" ? "function" : "text";
    return m.exports.flatMap(exp => {
      const expPath = [...resolvedExportPath, exportName(exp)];
      const impPath = [...resolvedImportPath, exportName(exp)];
      const modExp = { kind: exportKind, module: m, exp } as ModuleExport;
      return [
        new ImportToExportPath(impPath, expPath.join("/")),
        new ExportPathToExport(impPath.join("/"), modExp, []),
      ];
    });
  }

  /** resolve a flattened path as best we can, returning a path mapping entry
   * and a
   */
  function resolveFlatPath(
    impPath: string[],
    expPath: string[],
    impArgs: string[] | undefined,
  ): ResolvedEntry[] {
    const resolvedImp = absolutePath(impPath, importingModule);
    const resolvedExp = absolutePath(expPath, importingModule);

    const impArgsStr = impArgs ? `(${impArgs.join(", ")})` : "";
    const expPathStr = resolvedExp.join("/") + impArgsStr;

    const entries: ResolvedEntry[] = [
      new ImportToExportPath(resolvedImp, expPathStr),
    ];

    // try and resolve as an exported element as well
    const modExp = registry.getModuleExport(importingModule, resolvedExp);
    // dlog({ modExp: !!modExp, resolvedExp });
    if (modExp) {
      const expImpArgs = matchExportImportArgs(
        importingModule,
        imp,
        impArgs ?? [],
        modExp.module,
        modExp.exp,
      );
      entries.push(new ExportPathToExport(expPathStr, modExp, expImpArgs));
    }
    return entries;
  }
}

function absolutePath(pathSegments: string[], mod: TextModule): string[] {
  if (pathSegments[0] === ".") {
    const moduleDir = dirname(mod.modulePath);
    const joined = [moduleDir, ...pathSegments.slice(1)].join("/");
    const modulePath = normalize(joined);
    return modulePath.split("/");
  } else {
    return pathSegments;
  }
}

function matchExportImportArgs(
  impMod: TextModule | GeneratorModule,
  imp: TreeImportElem,
  impArgs: string[],
  expMod: TextModule | GeneratorModule,
  exp: ExportElem | GeneratorExport,
): StringPairs {
  const expArgs = exp.args ?? [];
  if (expArgs.length !== impArgs.length) {
    if (impMod.kind === "text")
      moduleLog(impMod, imp.start, "mismatched import and export params");
    if (expMod.kind === "text") moduleLog(expMod, (exp as ExportElem).start);
  }
  return expArgs.map((p, i) => [p, impArgs[i]]);
}
