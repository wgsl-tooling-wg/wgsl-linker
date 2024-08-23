import { expect, test } from "vitest";
import { importResolutionMap } from "../ImportResolutionMap.js";
import { exportsToStrings, pathsToStrings } from "../LogResolveMap.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { TextExport } from "../ParseModule.js";

test("simple tree", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         import bar/foo
         fn main() { foo(); }
      `,
      "bar.wgsl": `
         module bar

         export fn foo() { }
        `,
    },
  });
  const parsedModules = registry.parsed();
  const impMod = parsedModules.findTextModule("./main")!;

  const treeImports = impMod.imports.filter((i) => i.kind === "treeImport");
  const resolveMap = importResolutionMap(impMod, treeImports, parsedModules);

  expect(resolveMap.exportMap.size).eq(1);
  const [impPath, impToExp] = [...resolveMap.exportMap.entries()][0];
  expect(impPath).eq("bar/foo");
  expect(impToExp.modExp.module.modulePath).eq("bar");
  expect((impToExp.modExp.exp as TextExport).ref.name).eq("foo");

  expect(resolveMap.pathsMap.length).eq(1);
  const [impSegments, expSegments] = resolveMap.pathsMap[0];
  expect(impSegments).deep.eq(["bar", "foo"]);
  expect(expSegments).eq("bar/foo");
});

test("tree with path segment list", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         import bar/{foo, zah};
         fn main() { foo(); zah();}
      `,
      "./bar.wgsl": `
         module bar
         export fn foo() { }
         export fn zah() { }
        `,
    },
  });
  const parsedModules = registry.parsed();
  const impMod = parsedModules.findTextModule("./main")!;
  const treeImports = impMod.imports.filter((i) => i.kind === "treeImport");
  const resolveMap = importResolutionMap(impMod, treeImports, parsedModules);
  expect(pathsToStrings(resolveMap)).deep.eq([
    "bar/foo -> bar/foo",
    "bar/zah -> bar/zah",
  ]);
  expect(exportsToStrings(resolveMap)).deep.eq([
    "bar/foo -> bar/foo",
    "bar/zah -> bar/zah",
  ]);
});

test("tree with trailing wildcard", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         import ./bar/*;
         fn main() { bar.foo(); bar.zah();}
      `,
      "./bar.wgsl": `
         export fn foo() { }
         export fn zah() { }
        `,
    },
  });
  const parsedModules = registry.parsed();
  const impMod = parsedModules.findTextModule("./main")!;
  const treeImports = impMod.imports.filter((i) => i.kind === "treeImport");
  const resolveMap = importResolutionMap(impMod, treeImports, parsedModules);
  expect(pathsToStrings(resolveMap)).deep.eq([
    "bar/foo -> bar/foo",
    "bar/zah -> bar/zah",
  ]);
  expect(exportsToStrings(resolveMap)).deep.eq([
    "bar/foo -> bar/foo",
    "bar/zah -> bar/zah",
  ]);
});

test.skip("tree with generator");
test.skip("tree with segment list of trees");
