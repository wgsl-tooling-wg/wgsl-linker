import { _withBaseLogger } from "mini-parse";
import { logCatch } from "mini-parse/test-util";
import { expect, test } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { simpleTemplate } from "../templates/SimpleTemplate.js";
import { linkTestOpts, linkTest } from "./TestUtil.js";

// TODO mv to import cases
test("simple import", () => {
  const myModule = `
    export fn foo() { /* fooImpl */ }
  `;

  const src = `
    import ./file1/foo";

    fn bar() {
      foo();
    }
  `;
  const linked = linkTest(src, myModule);
  expect(linked).contains("fn bar()");
  expect(linked).includes("fooImpl");
  expect(linked).not.includes("import");
  expect(linked).not.includes("export");
});

test("copy root elements linked output", () => {
  const rootStruct = "struct Uniforms {\n  a: u32\n}";
  const rootVar = `@group(0) @binding(0) var<uniform> u: Uniforms;`;
  const rootFn = `fn main() { }`;
  const src = `
    ${rootStruct}
    ${rootVar}
    ${rootFn}
  `;
  const linked = linkTest(src);
  expect(linked).includes(rootStruct);
  expect(linked).includes(rootVar);
  expect(linked).includes(rootFn);
});

test("import foo as bar", () => {
  const myModule = `
    export fn foo() { /* fooImpl */ }
   `;

  const src = `
    import ./file1/foo as bar;

    fn main() {
      bar();
    }
   `;
  const linked = linkTest(src, myModule);
  expect(linked).contains("fn bar()");
});


test("#import twice doesn't get two copies", () => {
  const module1 = `
    export fn foo() { /* fooImpl */ }
  `;
  const module2 = `
    import ./file1/foo
    export fn bar() { foo(); }

  `;
  const src = `
    import ./file1/foo
    import ./file2/bar

    fn main() {
      foo();
      bar();
    }
  `;
  const linked = linkTest(src, module1, module2);
  const matches = linked.matchAll(/fooImpl/g);
  expect([...matches].length).toBe(1);
});

test("imported fn calls support fn with root conflict", () => {
  const src = `
    import foo from ./file1

    fn main() { foo(); }
    fn conflicted() { }
  `;
  const module1 = `
    export fn foo() {
      conflicted(0);
      conflicted(1);
    }
    fn conflicted(a:i32) {}
  `;
  const linked = linkTest(src, module1);
  expect(linked).includes("fn conflicted(");
  expect(linked).includes("conflicted()");
  expect(linked).includes("conflicted0(0)");
  expect(linked).includes("conflicted0(1)");
});

test("import twice with two as names", () => {
  const src = `
    import ./file1/foo as bar
    import ./file1/foo as zap

    fn main() { bar(); zap(); }
  `;
  const module1 = `
    export fn foo() { }
  `;
  const linked = linkTest(src, module1);
  expect(linked).includes("fn main() { bar(); bar(); }");
});

test("import transitive conflicts with main", () => {
  const src = `
    import ./file1/mid

    fn main() {
      mid();
    }

    fn grand() {
      /* main impl */
    }
  `;
  const module1 = `
    import ./file2/grand
    
    export fn mid() { grand(); }
  `;
  const module2 = `
    export fn grand() { /* grandImpl */ }
  `;
  const linked = linkTest(src, module1, module2);
  expect(linked).includes("mid() { grand0(); }");
});

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
  expect(linked).contains("/* module2 */");
});

test("multiple exports from the same module", () => {
  const src = `
    import ./file1/{foo, bar}

    fn main() {
      foo();
      bar();
    }
  `;
  const module1 = `
    export fn foo() { }
    export fn bar() { }
  `;
  const linked = linkTest(src, module1);
  expect(linked).toMatchSnapshot();
});

test("import and resolve conflicting support function", () => {
  const src = `
    import ./file1/foo as bar

    fn support() { 
      bar();
    }
  `;
  const module1 = `
    export
    fn foo() {
      support();
    }

    fn support() { }
  `;
  const linked = linkTest(src, module1);
  const origMatch = linked.matchAll(/\bsupport\b/g);
  expect([...origMatch].length).toBe(1);
  const module1Match = linked.matchAll(/\bsupport0\b/g);
  expect([...module1Match].length).toBe(2);
  const barMatch = linked.matchAll(/\bbar\b/g);
  expect([...barMatch].length).toBe(2);
});

test("import support fn that references another import", () => {
  const src = `
    import ./file1/foo

    fn support() { 
      foo();
    }
  `;
  const module1 = `
    import ./file2/bar

    export fn foo() {
      support();
      bar();
    }

    fn support() { }
  `;
  const module2 = `
    export fn bar() {
      support();
    }

    fn support() { }
  `;

  const linked = linkTest(src, module1, module2);

  const origMatch = linked.matchAll(/\bsupport\b/g);
  expect([...origMatch].length).toBe(1);
  const module1Match = linked.matchAll(/\bsupport0\b/g);
  expect([...module1Match].length).toBe(2);
  const module2Match = linked.matchAll(/\bsupport1\b/g);
  expect([...module2Match].length).toBe(2);
});

test("import support fn from two exports", () => {
  const src = `
    import ./file1/foo
    import ./file1/bar
    fn main() {
      foo();
      bar();
    }
  `;
  const module1 = `
    export fn foo() {
      support();
    }

    export fn bar() {
      support();
    }

    fn support() { }
  `;

  const linked = linkTest(src, module1);
  const supportMatch = linked.matchAll(/\bsupport\b/g);
  expect([...supportMatch].length).toBe(3);
});

test("import a struct", () => {
  const src = `
    import ./file1/AStruct

    fn main() {
      let a = AStruct(1u); 
    }
  `;
  const module1 = `
    export struct AStruct {
      x: u32,
    }
  `;
  const linked = linkTest(src, module1);
  expect(linked).contains("struct AStruct {");
});

test("import fn with support struct constructor", () => {
  const src = `
    import ./file1/elemOne

    fn main() {
      let ze = elemOne();
    }
  `;
  const module1 = `
    struct Elem {
      sum: u32
    }

    export fn elemOne() -> Elem {
      return Elem(1u);
    }
  `;
  const linked = linkTest(src, module1);
  expect(linked).contains("struct Elem {");
  expect(linked).contains("fn elemOne() ");
});

test("import a transitive struct", () => {
  const src = `
    import ./file1/AStruct

    struct SrcStruct {
      a: AStruct,
    }
  `;
  const module1 = `
    import ./file2/BStruct

    export struct AStruct {
      s: BStruct,
    }
  `;
  const module2 = `
    export struct BStruct {
      x: u32,
    }
  `;
  const linked = linkTest(src, module1, module2);
  expect(linked).contains("struct SrcStruct {");
  expect(linked).contains("struct AStruct {");
  expect(linked).contains("struct BStruct {");
});

test("'import as' a struct", () => {
  const src = `
    import AStruct as AA from ./file1

    fn foo (a: AA) { }
  `;

  const module1 = `
    #export 
    struct AStruct { x: u32 }
  `;

  const linked = linkTest(src, module1);
  expect(linked).contains("struct AA {");
});


test("import a struct with name conflicting support struct", () => {
  const src = `
    import ./file1/AStruct

    struct Base {
      b: i32
    }

    fn foo() -> AStruct {let a:AStruct; return a;}
  `;
  const module1 = `
    struct Base {
      x: u32
    }

    export struct AStruct {
      x: Base
    }
  `;

  const linked = linkTest(src, module1);
  expect(linked).contains("struct Base {");
  expect(linked).contains("struct Base0 {");
  expect(linked).contains("x: Base0"); // TBD
});


test("ext params don't replace override", () => {
  const src = `
    override workgroupSizeX = 4u;
  `;

  const linked = linkTestOpts({ runtimeParams: { workgroupSizeX: 4 } }, src);
  expect(linked).contains("override workgroupSizeX = 4u;");
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
  expect(linked).contains("step < 128");
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
  expect(linked).includes("step < 128");
});


test("copy alias to output", () => {
  const src = `
    alias MyType = u32;
  `;
  const linked = linkTest(src);
  expect(linked).toContain("alias MyType = u32;");
});

test("copy diagnostics to output", () => {
  const src = `
    diagnostic(off,derivative_uniformity);
  `;
  const linked = linkTest(src);
  expect(linked).toContain("diagnostic(off,derivative_uniformity);");
});


/** -- not yet with gleam syntax --- */
  

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
  expect(linked).includes("a: MyElem");
});

test("#import twice with different params", () => {
  const src = `
    #import foo(A) from ./file1
    #import foo(B) as bar from ./file1

    fn main() {
      bar();
      foo();
    }
  `;
  const module0 = `
    #export(X)
    fn foo(x:X) { /* X */ }
  `;

  const linked = linkTest(src, module0);
  expect(linked).includes("fn bar(x:B) { /* B */ }");
  expect(linked).includes("fn foo(x:A) { /* A */ }");
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
  expect(linked).contains("x: i32");
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
  expect(linked).contains("step < 128");
  expect(linked).contains("/* Bar */");
});

test("#import using external param", () => {
  const src = `
    #import foo(ext.workgroupSize) from ./file1

    fn main() { foo(); }
  `;

  const module1 = `
    // #export(threads)
    fn foo () {
      for (var step = 0; step < threads; step++) { 
      }
    }
  `;

  const runtimeParams = { workgroupSize: 128 };
  const linked = linkTestOpts({ runtimeParams }, src, module1);
  expect(linked).contains("step < 128");
});

test("external param w/o ext. prefix doesn't override imp/exp params", () => {
  const src = `
    #import foo(workgroupThreads) from ./file1

    fn main() {
      foo();
    }
  `;
  const module1 = `
    #export(threads)
    fn foo() {
      for (var step = 0; step < threads; step++) { 
      }
    }
  `;
  const runtimeParams = { workgroupThreads: 128 };
  const linked = linkTestOpts({ runtimeParams }, src, module1);
  expect(linked).not.includes("step < 128");
  expect(linked).includes("step < workgroupThreads");
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
  expect(linked).includes("step < 128");
});