import { parseSrcModule, parseWESL, WeslAST } from "./ParseWESL.ts";
import { normalize, noSuffix } from "./PathUtil.ts";
import { SrcModule } from "./Scope.ts";

export interface ParsedRegistry2 {
  modules: Record<string, WeslAST>; // key is module path, e.g. "rand_pkg::foo::bar"
}

export function parsedRegistry(): ParsedRegistry2 {
  return { modules: {} };
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

/** Look up a module by name, or :: separated module path or relative module path */
export function selectModule(
  parsed: ParsedRegistry2,
  selectPath: string,
  packageName = "package",
): WeslAST | undefined {
  let modulePath: string;
  if (selectPath.includes("::")) {
    modulePath = selectPath;
  } else if (selectPath.includes("/")) {
    modulePath = fileToModulePath(selectPath, packageName);
  } else {
    modulePath = packageName + "::" + selectPath;
  }

  return parsed.modules[modulePath];
}

/**
 * @param srcFiles    map of source strings by file path
 *                    key is '/' separated path
 *                    value is wesl source string
 * @param registry    add parsed modules to this registry
 * @param packageName name of package
 */
export function parseIntoRegistry(
  srcFiles: Record<string, string>,
  registry: ParsedRegistry2,
  packageName: string = "package",
  maxParseCount?: number,
): void {
  const srcModules: SrcModule[] = Object.entries(srcFiles).map(
    ([filePath, src]) => {
      const modulePath = fileToModulePath(filePath, packageName);
      return { modulePath, filePath, src };
    },
  );
  srcModules.forEach(mod => {
    const parsed = parseSrcModule(mod, maxParseCount);
    if (registry.modules[mod.modulePath]) {
      throw new Error(`duplicate module path: '${mod.modulePath}'`);
    }
    registry.modules[mod.modulePath] = parsed;
  });
}

function fileToModulePath(filePath: string, packageName: string): string {
  const strippedPath = noSuffix(normalize(filePath));
  const moduleSuffix = strippedPath.replaceAll("/", "::");
  const modulePath = packageName + "::" + moduleSuffix;
  return modulePath;
}
