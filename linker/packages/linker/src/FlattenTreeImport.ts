import { tracing } from "mini-parse";
import {
  ImportTree,
  PathSegment,
  SegmentList,
  SimpleSegment,
} from "./ImportTree.js";

export interface FlatImport {
  importPath: string[];
  modulePath: string[];
}

/**
 * Simplify importTree into a flattened map from import paths to module paths.
 *
 * @return map from import path (with 'as' renaming) to module Path
 */
export function flattenTreeImport(imp: ImportTree): FlatImport[] {
  return recursiveResolve([], [], imp.segments);

  /** recurse through segments of path, producing  */
  function recursiveResolve(
    resolvedImportPath: string[],
    resolvedExportPath: string[],
    remainingPath: PathSegment[],
  ): FlatImport[] {
    const [segment, ...rest] = remainingPath;
    if (segment === undefined) {
      throw new Error(`undefined segment ${imp.segments}`);
    }
    if (segment instanceof SimpleSegment) {
      const importPath = [...resolvedImportPath, segment.as || segment.name];
      const modulePath = [...resolvedExportPath, segment.name];
      if (rest.length) {
        // we're in the middle of the path so keep recursing
        return recursiveResolve(importPath, modulePath, rest);
      } else {
        return [{ importPath, modulePath }];
      }
    }
    if (segment instanceof SegmentList) {
      // resolve path with each element in the list
      return segment.list.flatMap(elem => {
        const rPath = [elem, ...rest];
        return recursiveResolve(resolvedImportPath, resolvedExportPath, rPath);
      });
    } else if (segment instanceof ImportTree) {
      return recursiveResolve(
        resolvedImportPath,
        resolvedExportPath,
        segment.segments,
      );
    }

    if (tracing) console.log("unknown segment type", segment); // should be impossible
    return [];
  }
}
