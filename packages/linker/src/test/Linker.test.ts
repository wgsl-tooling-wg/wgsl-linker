import { expect, test } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { simpleTemplate } from "../templates/SimpleTemplate.js";
import { expectNoLog, linkTest, linkTestOpts } from "./TestUtil.js";

/* --- these tests rely on features not yet portable in wesl --- */

test("ext params don't replace override", () => {
  const src = `
    override workgroupSizeX = 4u;
  `;

  const linked = linkTestOpts({ runtimeParams: { workgroupSizeX: 4 } }, src);
  expect(linked).toContain("override workgroupSizeX = 4u;");
});

test("import using replace template and ext param", () => {
  const src = `
    import ./file1/foo

    fn main() { foo(); }
  `;

  const module1 = `
    #template simple

    export fn foo () {
      for (var step = 0; step < Threads; step++) { 
      }
    }
  `;

  const templates = [simpleTemplate];
  const runtimeParams = { Threads: 128 };
  const linked = linkTestOpts({ templates, runtimeParams }, src, module1);
  expect(linked).toContain("step < 128");
});

test("#template in src", () => {
  const src = `
    #template simple
    fn main() {
      for (var step = 0; step < threads; step++) { 
      }
    }
  `;
  const templates = [simpleTemplate];
  const runtimeParams = { threads: 128 };
  const linked = linkTestOpts({ templates, runtimeParams }, src);
  expect(linked).toContain("step < 128");
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

test("import with parameter", () => {
  const myModule = `
    export(Elem)
    fn foo(a: Elem) { /* fooImpl */ }
  `;

  const src = `
    struct MyElem {}

    import foo(MyElem) from "./file1"
    fn bar() {
      foo();
    }
  `;
  const linked = linkTest(src, myModule);
  expect(linked).toContain("a: MyElem");
});

test("#import twice with different params", () => {
  const src = `
    import foo(A) from ./file1
    import foo(B) as bar from ./file1

    fn main() {
      bar();
      foo();
    }
  `;
  const module0 = `
    export(X)
    fn foo(x:X) { /* X */ }
  `;

  const linked = linkTest(src, module0);
  expect(linked).toContain("fn bar(x:B) { /* B */ }");
  expect(linked).toContain("fn foo(x:A) { /* A */ }");
});

test("import a struct with imp/exp params", () => {
  const src = `
    #import AStruct(i32) from ./file1

    fn foo () { b = AStruct(1); }
  `;

  const module1 = `
    #if typecheck
    alias elemType = u32;
    #endif

    #export (elemType)
    struct AStruct { x: elemType }
  `;

  const linked = linkTest(src, module1);
  expect(linked).toContain("x: i32");
});

test("#import using simple template and imp/exp param", () => {
  const src = `
    #import foo(128) from ./file1

    fn main() { foo(); }
  `;

  const module1 = `
    #template simple

    #export(threads)
    fn foo () {
      for (var step = 0; step < threads; step++) {
        /* Foo */
      }
    }
  `;

  const templates = [simpleTemplate];
  const runtimeParams = { Foo: "Bar" };
  const linked = linkTestOpts({ templates, runtimeParams }, src, module1);
  expect(linked).toContain("step < 128");
  expect(linked).toContain("/* Bar */");
});

test("#import using external param", () => {
  const src = `
    import foo(ext.workgroupSize) from ./file1

    fn main() { foo(); }
  `;

  const module1 = `
    export(threads)
    fn foo () {
      for (var step = 0; step < threads; step++) { 
      }
    }
  `;

  const runtimeParams = { workgroupSize: 128 };
  const linked = linkTestOpts({ runtimeParams }, src, module1);
  expect(linked).toContain("step < 128");
});

test("external param w/o ext. prefix doesn't override imp/exp params", () => {
  const src = `
    import foo(workgroupThreads) from ./file1

    fn main() {
      foo();
    }
  `;
  const module1 = `
    export(threads)
    fn foo() {
      for (var step = 0; step < threads; step++) { 
      }
    }
  `;
  const runtimeParams = { workgroupThreads: 128 };
  const linked = linkTestOpts({ runtimeParams }, src, module1);
  expect(linked).not.toContain("step < 128");
  expect(linked).toContain("step < workgroupThreads");
});

test("import with simple template", () => {
  const src = `
    import ./file1/foo
    fn main() { foo(); }
  `;
  const file1 = `
    #template simple
    export fn foo() {
      for (var step = 0; step < WORKGROUP_SIZE; step++) { }
    }
  `;
  const registry = new ModuleRegistry({
    wgsl: { "./main.wgsl": src, "./file1.wgsl": file1 },
    templates: [simpleTemplate],
  });
  const linked = registry.link("./main", { WORKGROUP_SIZE: "128" });
  expect(linked).toContain("step < 128");
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
})