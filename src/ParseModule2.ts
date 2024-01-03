import {
  AbstractElem,
  ExportElem,
  FnElem,
  ImportElem,
} from "./AbstractElems.js";
import { parseMiniWgsl } from "./MiniWgslParse.js";

/** module with exportable text fragments that are optionally transformed by a templating engine */
export interface TextModule2 {
  template?: string;
  exports: TextExport2[];
  fns: FnElem[];
  imports: ImportElem[];
  name: string;
}

export interface TextExport2 {
  name: string;
  ref: FnElem; // TODO | StructElem (| global var?)
  src: string;
  exp: ExportElem;
  args: string[];
}

let unnamedModuleDex = 0;

export function parseModule2(
  src: string,
  defaultModuleName?: string
): TextModule2 {
  const parsed = parseMiniWgsl(src);
  const exports = findExports(src, parsed);
  const fns = parsed.filter((e) => e.kind === "fn") as FnElem[];
  const imports = parsed.filter((e) => e.kind === "import") as ImportElem[];
  const moduleName = undefined; // TODO parse #module

  const name = moduleName ?? defaultModuleName ?? `module${unnamedModuleDex++}`;
  return { name, exports, fns, imports };
}

// TODO consider how to export fields inside a struct.. currently indicated #export foo
// should we still do text capture for fields? seems better to export (and merge?) the struct itself..

function findExports(src: string, parsed: AbstractElem[]): TextExport2[] {
  const exports: TextExport2[] = [];
  parsed.forEach((elem, i) => {
    if (elem.kind === "export") {
      const next = parsed[i + 1];
      const args = elem.args ?? [];
      if (next?.kind === "fn") {
        exports.push({ exp: elem, args, ref: next, name: next.name, src });
      }
    }
  });
  return exports;
}