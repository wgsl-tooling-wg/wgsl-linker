import { dlog } from "berry-pretty";
import { TreeImportElem } from "./AbstractElems.js";
import { importResolutionMap, ResolveMap } from "./ImportResolutionMap.js";
import { linkWgslModule } from "./Linker.js";
import {
  GeneratorExport,
  GeneratorModule,
  GeneratorModuleExport,
  ModuleExport,
  ModuleRegistry,
  relativeToAbsolute,
  TextModuleExport,
} from "./ModuleRegistry.js";
import { parseModule, TextExport, TextModule } from "./ParseModule.js";
import { dirname, normalize, noSuffix } from "./PathUtil.js";

/** parse wgsl files and provided indexed access to modules and exports */
export class ParsedRegistry {
  private textModules: TextModule[] = [];

  constructor(
    public registry: ModuleRegistry,
    public conditions: Record<string, any> = {}
  ) {
    this.textModules = [];
    this.registry.wgslSrc.forEach((src, fileName) => {
      this.parseOneModule(src, conditions, fileName);
    });
  }

  link(moduleSpecifier: string): string {
    const module = this.findTextModule(moduleSpecifier);
    if (!module) {
      throw new Error(`Module not found: ${moduleSpecifier}`);
    }
    return linkWgslModule(module, this, this.conditions);
  }

  /** parse one module, register exports for later searching */
  private parseOneModule(
    src: string,
    params: Record<string, any> = {},
    modulePath: string
  ): void {
    const m = parseModule(src, modulePath, params, this.registry.templates);
    this.textModules.push(m);
  }

  /** @return a ResolveMap to make it easier to resolve imports from the provided module */
  importResolveMap(importingModule: TextModule): ResolveMap {
    const treeImports: TreeImportElem[] = importingModule.imports.filter(
      (i) => i.kind === "treeImport"
    ); // TODO drop filter when we drop other import kinds

    // TODO cache
    return importResolutionMap(importingModule, treeImports, this);
  }

  /** @return a ModuleExport if the provided pathSegments
   * reference an export in a registered module */
  getModuleExport(
    importingModule: TextModule, // TODO drop this and require pathSegments to be absolute
    pathSegments: string[]
  ): ModuleExport | undefined {
    const exportName = pathSegments[pathSegments.length - 1];
    if (pathSegments[0] === ".") {
      // relative module path in current package
      const moduleDir = dirname(importingModule.modulePath);
      const joined = [moduleDir, ...pathSegments.slice(1, -1)].join("/");
      const modulePath = normalize(joined);
      const result = this.findExport(modulePath, exportName);
      // dlog({ modulePath, exportName, result: !!result });
      return result;
    } else {
      // package rooted path
      const modulePath = pathSegments.slice(0, -1).join("/");
      const result = this.findExport(modulePath, exportName);
      // dlog({ modulePath, exportName, result: !!result });
      return result;
    }
  }

  private findExport(
    modulePath: string,
    exportName: string
  ): TextModuleExport | GeneratorModuleExport | undefined {
    const module = this.findTextModule(modulePath);
    // dlog({ modulePath, module: !!module });
    const exp = module?.exports.find((e) => e.ref.name === exportName);
    if (exp && module) {
      return { module, exp: exp, kind: "text" };
    }

    return this.registry.generators.get(modulePath);
  }

  findModule(
    moduleSpecifier: string
  ): TextModule | GeneratorModule | undefined {
    return (
      this.findTextModule(moduleSpecifier) ??
      this.registry.generators.get(moduleSpecifier)?.module
    );
  }

  /**
   * Find a text module by module specifier
   * @param packageName requesting package name (for resolving relative paths)
   */
  findTextModule(
    moduleSpecifier: string,
    packageName = "_root"
  ): TextModule | undefined {
    // const modulePaths = this.textModules.map((m) => m.modulePath);
    // dlog({ modulePaths });
    const resolvedPath = moduleSpecifier.startsWith(".")
      ? relativeToAbsolute(moduleSpecifier, packageName)
      : moduleSpecifier;
    const result =
      this.textModules.find((m) => m.modulePath === resolvedPath) ??
      this.textModules.find((m) => noSuffix(m.modulePath) === resolvedPath);
    // dlog({ moduleSpecifier, packageName, result: !!result });
    return result;
  }

}

export function exportName(exp: TextExport | GeneratorExport): string {
  // TODO make TextExport into a class or give kinds to avoid unsound casts
  const asTextExport = exp as TextExport;
  const asGenExport = exp as GeneratorExport;
  return asTextExport.ref?.name ?? asGenExport.name;
}
