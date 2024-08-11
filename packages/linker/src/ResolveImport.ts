import { dlog } from "berry-pretty";
import { ResolveMap } from "./ImportResolutionMap.js";
import { logResolveMap } from "./LogResolveMap.js";
import {
  GeneratorExport,
  GeneratorModule,
  ModuleExport,
} from "./ModuleRegistry.js";
import { overlapTail } from "./Util.js";
import { StringPairs } from "./TraverseRefs.js";
import { moduleLog } from "./LinkerLogging.js";
import { ExportElem, TreeImportElem } from "./AbstractElems.js";
import { TextModule } from "./ParseModule.js";

export interface ResolvedImport {
  modExp: ModuleExport;
  // importElem: TreeImportElem;
  callSegments: string[];
  expImpArgs: StringPairs;
}

/** resolve an import to an export using the resolveMap
 * @param callPath the reference to the import, e.g. "foo::bar" from
 *    import pkg::foo
 *    fn () { foo::bar(); }
 *
 * Cases: all of these find export path pkg/foo
 *   foo() -> import pkg::foo,
 *   bar() -> import pkg::foo as bar
 *   pkg::foo()  -> import pkg
 *   pkg::foo()  -> import pkg::foo
 *   npkg::foo() -> import pkg as npkg
 *   npkg.foo()  -> import pkg as npkg
 */
export function resolveImport(
  callPath: string,
  resolveMap: ResolveMap,
): ResolvedImport | undefined {
  const callSegments = callPath.includes("::")
    ? callPath.split("::")
    : callPath.split(".");

  const expPath = impToExportPath(callSegments, resolveMap);
  if (expPath) {
    const impToExp = resolveMap.exportMap.get(expPath);

    if (impToExp) {
      const { expMod, expImpArgs } = impToExp;
      return { modExp:expMod, callSegments, expImpArgs };
    }
  }

  return undefined;
}

/** Convert a caller path to an export path,
 * caller paths are allowed to overlap with export paths
 * (at least with rust style call syntax, where 
 * e.g. foo overlaps:
 *  import pkg::foo; 
 *  foo::bar() 
 */
function impToExportPath(
  impSegments: string[],
  resolveMap: ResolveMap
): string | undefined {
  const { pathsMap } = resolveMap;
  for (const [imp, exp] of pathsMap) {
    const impTail = overlapTail(imp, impSegments);
    if (impTail) {
      console.assert(imp.length === exp.length);
      const combined = [...exp, ...impTail];
      return combined.join("/");
    }
  }

  return undefined;
}