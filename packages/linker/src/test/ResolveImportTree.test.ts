import { dlog } from "berry-pretty";
import { expect, test } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { TextExport, TextModule } from "../ParseModule.js";
import {
  ResolvedExportElement,
  resolvedToString,
  resolveImports,
} from "../ResolveImportTree.js";

test("simple tree", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         import bar::foo;
         module main
         fn main() { foo(); }
      `,
      "bar.wgsl": `
         module bar

         export fn foo() { }
        `,
    },
  });
  registry._parseSrc();
  const impMod = registry.moduleByPath(["main"]) as TextModule;

  const treeImports = impMod.imports.filter((i) => i.kind === "treeImport");
  const resolved = resolveImports(impMod, treeImports, registry);
  expect(resolved.size).eq(1);
  const [imp, exp] = resolved.entries().next().value as [
    string[],
    ResolvedExportElement,
  ];
  expect(imp).to.deep.eq(["bar", "foo"]);
  expect(exp.expMod.module.name).eq("bar");
  expect((exp.expMod.export as TextExport).ref.name).eq("foo");
});

test.skip("tree with path segment list");
test.skip("tree with trailing wildcard");
test.skip("tree with generator");
