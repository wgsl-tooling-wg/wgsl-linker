import { expect, test } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.js";

test("findTextModule", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         module bar
         export fn foo() { }
      `,
    },
  });
  const parsed = registry.parsed();
  const m = parsed.findTextModule("bar");
  expect(m?.modulePath).toBe("bar");
});

test("getModuleExport", () => {
  const registry = new ModuleRegistry({
    wgsl: {
      "main.wgsl": `
         import bar/foo;
         fn main() { foo(); }
      `,
      "bar.wgsl": `
         module bar

         export fn foo() { }
        `,
    },
  });
  const parsed = registry.parsed();
  const impMod = parsed.findTextModule("./main")!;

  const m = parsed.getModuleExport(impMod, ["bar", "foo"]);
  expect(m?.module.modulePath).toBe("bar");
});
