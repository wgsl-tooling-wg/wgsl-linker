import { ParsedRegistry } from "./ParsedRegistry.js";
import { TextExport, TextModule } from "./ParseModule.js";
import { normalize } from "./PathUtil.js";
import { WgslBundle } from "./WgslBundle.js";

export type CodeGenFn = (
  name: string,
  params: Record<string, string>,
) => string;

export interface GeneratorExport {
  name: string;
  args: string[];
  generate: CodeGenFn;
}

/** a named code generation function */
export interface RegisterGenerator {
  /** export name for this generator */
  name: string;

  /** module namespace for this generator */
  moduleName: string;

  /** function to generate code at runtime */
  generate: CodeGenFn;

  /** arguments to pass when importing from this generator */
  args?: string[];
}

/** a single export from a module */
export type ModuleExport = TextModuleExport | GeneratorModuleExport;

export interface TextModuleExport {
  module: TextModule;
  exp: TextExport;
  kind: "text";
}

export interface GeneratorModule {
  kind: "generator";
  modulePath: string;
  exports: GeneratorExport[];
}

export interface GeneratorModuleExport {
  module: GeneratorModule;
  exp: GeneratorExport;
  kind: "function";
}

export interface RegistryParams {
  /** record of file names and wgsl text for modules */
  wgsl?: Record<string, string>;

  /** record of file names and wgsl text for modules */
  libs?: WgslBundle[];

  /** code generation functions */
  generators?: RegisterGenerator[];
}

const libExp = /\/lib\.w[eg]sl/i;

/**
 * A ModuleRegistry collects exportable code fragments, code generator functions.
 *
 * The ModuleRegistry provides everything required for linkWgsl to process
 * #import statements and generate a complete wgsl shader.
 */
export class ModuleRegistry {
  // map from absolute module path to wgsl/wesl src text
  wgslSrc = new Map<string, string>();
  generators = new Map<string, GeneratorModuleExport>();

  constructor(args?: RegistryParams) {
    if (!args) return;
    const { wgsl = {}, libs = [], generators } = args;

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

    generators?.map(g => this.registerGenerator(g));
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

  /** register a function that generates code on demand */
  registerGenerator(reg: RegisterGenerator): void {
    const exp: GeneratorExport = {
      name: reg.name,
      args: reg.args ?? [],
      generate: reg.generate,
    };
    const module: GeneratorModule = {
      kind: "generator",
      modulePath: reg.moduleName,
      exports: [exp],
    };

    this.generators.set(module.modulePath, { kind: "function", module, exp });
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
