import { dlog } from "berry-pretty";
import { parseWESL, WeslAST } from "./ParseWESL.ts";

export interface ParsedRegistry2 {
  modules: Record<string, WeslAST>; // key is module path. "rand_pkg::foo::bar"
}

/**
 * Parse WESL each src module (file) into AST elements and a Scope tree.
 * @param src keys are module paths, values are wesl src strings
 */
export function parseWeslSrc(src: Record<string, string>): ParsedRegistry2 {
  const parsedEntries = Object.entries(src).map(([path, src]) => {
    const weslAST = parseWESL(src);
    return [path, weslAST];
  });
  return { modules: Object.fromEntries(parsedEntries) };
}

/** Look up a module by name or :: separated module path */
export function selectModule(
  parsed: ParsedRegistry2,
  modulePath: string,
): WeslAST | undefined {
  const fullPath =
    modulePath.includes("::") ? modulePath : `package::${modulePath}`;
  return parsed.modules[fullPath];
}
