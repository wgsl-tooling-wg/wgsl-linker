import { expect, test } from "vitest";
import { importResolutionMap } from "../ImportResolutionMap.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { TextExport } from "../ParseModule.js";
import { resolveImport } from "../ResolveImport.js";

test("resolveImport foo() from import bar/foo", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         import bar/foo;

         module main
         fn main() { foo(); }
      `,
      "bar.wgsl": `
         module bar

         export fn foo() { }
        `,
    },
  });
  const parsedModules = registry.parsed();
  const impMod = parsedModules.findTextModule("main")!;
  const treeImports = impMod.imports.filter((i) => i.kind === "treeImport");
  const resolveMap = importResolutionMap(impMod, treeImports, parsedModules);

  const found = resolveImport("foo", resolveMap);
  expect(found).toBeDefined();
  expect(found?.modExp.module.modulePath).toBe("bar");
  expect((found?.modExp.exp as TextExport).ref.name).toBe("foo");
});

test("resolveImport bar/foo() from import bar/foo", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         import bar/foo;
         module main
         fn main() { bar.foo(); }
      `,
      "bar.wgsl": `
         module bar

         export fn foo() { }
        `,
    },
  });
  const parsedModules = registry.parsed();
  const impMod = parsedModules.findTextModule("main")!;
  const treeImports = impMod.imports.filter((i) => i.kind === "treeImport");
  const resolveMap = importResolutionMap(impMod, treeImports, parsedModules);
  const found = resolveImport("bar.foo", resolveMap);
  expect(found).toBeDefined();
  expect(found?.modExp.module.modulePath).toBe("bar");
  expect((found?.modExp.exp as TextExport).ref.name).toBe("foo");
});
