import { expect, test } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { expectNoLog, linkTest, linkTestOpts } from "./TestUtil.js";

/* --- these tests rely on features not yet portable in wesl --- */

test("ext params don't replace override", () => {
  const src = `
    override workgroupSizeX = 4u;
  `;

  const linked = linkTestOpts({ runtimeParams: { workgroupSizeX: 4 } }, src);
  expect(linked).toContain("override workgroupSizeX = 4u;");
});

/** requires 'module' syntax, which may not make the shared design */
test("import foo from zap (multiple modules)", () => {
  const module1 = `
    module module1
    export fn foo() { /* module1 */ }
  `;
  const module2 = `
    module module2
    export fn foo() { /* module2 */ }
  `;

  const src = `
    import module2/{foo as baz}

    fn main() {
      baz();
    }
  `;

  const linked = linkTest(src, module1, module2);
  expect(linked).toContain("/* module2 */");
});

test("reference an alias", () => {
  const src = `
    alias Num = f32;

    fn main() { Num(1.0); }
  `;
  const registry = new ModuleRegistry({
    wgsl: { "./main.wgsl": src },
  });
  expectNoLog(() => registry.link("./main"));
});

test("handle a ptr type", () => {
  const src = `
    fn uint_bitfieldExtract_u1_i1_i1_(
      value: ptr<function, u32>, 
      bits: ptr<function, i32>) -> u32 { }
  `;
  const registry = new ModuleRegistry({
    wgsl: { "./main.wgsl": src },
  });
  expectNoLog(() => registry.link("./main"));
});
