import { ParsedRegistry } from "./ParsedRegistry.ts";
import { TextExport, TextModule } from "./ParseModule.ts";
import { normalize } from "./PathUtil.ts";
import { WgslBundle } from "./WgslBundle.ts";

/** a single export from a module */
export type ModuleExport = TextModuleExport;

export interface TextModuleExport {
  module: TextModule;
  exp: TextExport;
  kind: "text";
}

export interface RegistryParams {
  /** record of file names and wgsl text for modules */
  wgsl?: Record<string, string>;

  /** record of file names and wgsl text for modules */
  libs?: WgslBundle[];
}

const libExp = /\/lib\.w[eg]sl/i;

/**
 * A ModuleRegistry collects exportable code fragments.
 *
 * The ModuleRegistry provides everything required for linkWgsl to process
 * import statements and generate a complete wgsl shader.
 */
export class ModuleRegistry {
  // map from absolute module path to wgsl/wesl src text
  wgslSrc = new Map<string, string>();

  constructor(args?: RegistryParams) {
    if (!args) return;
    const { wgsl = {}, libs = [] } = args;

    Object.entries(wgsl).forEach(([fileName, src]) =>
      this.wgslSrc.set(relativeToAbsolute(fileName, "_root"), src),
    );

    libs.forEach(({ name, modules }) => {
      Object.entries(modules).forEach(([fileName, src]) => {
        const absPath = relativeToAbsolute(fileName, name);
        const canonPath =
          libExp.test(absPath) ?
            absPath.slice(0, -"/lib.wgsl".length)
          : absPath;
        this.wgslSrc.set(canonPath, src);
      });
    });
  }

  /**
   * Produce a linked wgsl string with all directives processed
   * (e.g. #import'd functions from other modules are inserted into the resulting string).
   * @param moduleName select the module to use as the root source
   * @param runtimeParams runtime parameters for #import/#export values,
   *  template values, and code generation parameters
   */
  link(moduleName: string, runtimeParams: Record<string, any> = {}): string {
    return this.parsed(runtimeParams).link(moduleName);
  }

  /** Parse the text modules in the registry */
  parsed(runtimeParams: Record<string, any> = {}): ParsedRegistry {
    return new ParsedRegistry(this, runtimeParams);
  }
}

export function relativeToAbsolute(
  relativePath: string,
  packageName: string,
): string {
  const normalPath = normalize(relativePath);
  const fullPath = `${packageName}/${normalPath}`;
  return fullPath;
}
