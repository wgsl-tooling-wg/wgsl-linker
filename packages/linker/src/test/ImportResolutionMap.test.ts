import { expect, test } from "vitest";
import { importResolutionMap } from "../ImportResolutionMap.js";
import {
  exportsToStrings,
  logResolveMap,
  pathsToStrings,
} from "../LogResolveMap.js";
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

  expect(resolveMap.exportMap.size).toBe(1);
  const [impPath, impToExp] = [...resolveMap.exportMap.entries()][0];
  expect(impPath).toBe("bar/foo");
  expect(impToExp.modExp.module.modulePath).toBe("bar");
  expect((impToExp.modExp.exp as TextExport).ref.name).toBe("foo");

  expect(resolveMap.pathsMap.length).toBe(1);
  const [impSegments, expSegments] = resolveMap.pathsMap[0];
  expect(impSegments).toEqual(["bar", "foo"]);
  expect(expSegments).toBe("bar/foo");
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
  expect(pathsToStrings(resolveMap)).toEqual([
    "bar/foo -> bar/foo",
    "bar/zah -> bar/zah",
  ]);
  expect(exportsToStrings(resolveMap)).toEqual([
    "bar/foo -> bar/foo",
    "bar/zah -> bar/zah",
  ]);
});

// TODO fixme wildcards
test.skip("tree with trailing wildcard", () => {
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
  logResolveMap(resolveMap);
  // expect(pathsToStrings(resolveMap)).toEqual([
  //   "bar/foo -> bar/foo",
  //   "bar/zah -> bar/zah",
  // ]);
  // expect(exportsToStrings(resolveMap)).toEqual([
  //   "bar/foo -> bar/foo",
  //   "bar/zah -> bar/zah",
  // ]);
});

test.skip("tree with generator");
test.skip("tree with segment list of trees");
