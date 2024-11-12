import { srcLog, SrcMap } from "mini-parse";
import {
  AbstractElem,
  AliasElem,
  ExportElem,
  ExtendsElem,
  FnElem,
  GlobalDirectiveElem,
  ModuleElem,
  StructElem,
  TreeImportElem,
  VarElem,
} from "./AbstractElems.js";
import { processConditionals } from "./Conditionals.js";
import { parseWgslD } from "./ParseWgslD.js";

/** module with exportable text fragments that are optionally transformed by a templating engine */
export interface TextModule {
  kind: "text";
  exports: TextExport[];
  fns: FnElem[];
  vars: VarElem[];
  structs: StructElem[];
  imports: (ExtendsElem | TreeImportElem)[];
  aliases: AliasElem[];
  globalDirectives: GlobalDirectiveElem[];

  modulePath: string; // full path to the module e.g "package/sub/foo", or "_root/sub/foo"

  /** original src for module */
  src: string;

  /** src code after processing #if conditionals  */
  preppedSrc: string;

  /** tracks changes through conditional processing for error reporting */
  srcMap: SrcMap;
}

/** an export elem annotated with the fn/struct to which it refers */
export interface TextExport extends ExportElem {
  ref: FnElem | StructElem;
}

export function preProcess(
  src: string,
  params: Record<string, any> = {},
): SrcMap {
  return processConditionals(src, params);
}

export function parseModule(
  src: string,
  naturalModulePath: string,
  params: Record<string, any> = {},
): TextModule {
  const srcMap = preProcess(src, params);

  const preppedSrc = srcMap.dest;
  const parsed = parseWgslD(preppedSrc, srcMap);
  const exports = findExports(parsed, srcMap);
  const fns = filterElems<FnElem>(parsed, "fn");
  const aliases = filterElems<AliasElem>(parsed, "alias");
  const globalDirectives = filterElems<GlobalDirectiveElem>(
    parsed,
    "globalDirective",
  );
  const imports = parsed.filter(
    e => e.kind === "extends" || e.kind === "treeImport",
  ) as (ExtendsElem | TreeImportElem)[];
  const structs = filterElems<StructElem>(parsed, "struct");
  const vars = filterElems<VarElem>(parsed, "var");
  const overridePath = filterElems<ModuleElem>(parsed, "module")[0]?.name;
  matchMergeImports(parsed, srcMap);

  const modulePath = overridePath ?? naturalModulePath;
  // dlog({ modulePath, overridePath });
  const kind = "text";
  return {
    ...{ kind, src, srcMap, preppedSrc, modulePath },
    ...{ exports, fns, structs, vars, imports },
    ...{ aliases, globalDirectives },
  };
}

export function filterElems<T extends AbstractElem>(
  parsed: AbstractElem[],
  kind: T["kind"],
): T[] {
  return parsed.filter(e => e.kind === kind) as T[];
}

function findExports(parsed: AbstractElem[], srcMap: SrcMap): TextExport[] {
  const results: TextExport[] = [];
  const exports = findKind<ExportElem>(parsed, "export");

  exports.forEach(([elem, i]) => {
    let next: AbstractElem | undefined;
    do {
      next = parsed[++i];
    } while (next?.kind === "extends");
    if (elem.kind === "export") {
      if (next?.kind === "fn" || next?.kind === "struct") {
        results.push({ ...elem, ref: next });
      } else {
        srcLog(srcMap, elem.start, `#export what? (#export a fn or struct)`);
      }
    }
  });
  return results;
}

/** fill in extendsElem field of structs */
function matchMergeImports(parsed: AbstractElem[], srcMap: SrcMap): void {
  const extendsElems = findKind<ExtendsElem>(parsed, "extends");
  extendsElems.forEach(([extendsElem, i]) => {
    let next: AbstractElem | undefined;
    do {
      next = parsed[++i];
    } while (next?.kind === "extends" || next?.kind === "export");
    if (next?.kind === "struct") {
      next.extendsElems = next.extendsElems ?? [];
      next.extendsElems.push(extendsElem);
    } else {
      srcLog(srcMap, extendsElem.start, `#extends not followed by a struct`);
    }
  });
}

function findKind<T extends AbstractElem>(
  parsed: AbstractElem[],
  kind: T["kind"],
): [T, number][] {
  return parsed.flatMap((elem, i) =>
    elem.kind === kind ? ([[elem, i]] as [T, number][]) : [],
  );
}
