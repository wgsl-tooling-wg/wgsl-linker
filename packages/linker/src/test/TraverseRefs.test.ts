import { _withBaseLogger } from "mini-parse";
import { logCatch } from "mini-parse/test-util";
import { expect, test } from "vitest";
import { refFullName } from "../Linker.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { FoundRef, refName, TextRef, traverseRefs } from "../TraverseRefs.js";

test("traverse a fn to struct ref", () => {
  const src = `
    import ./file1/AStruct;

    fn main() {
      let a:AStruct; 
    }
  `;
  const module1 = `
    export
    struct AStruct {
      x: u32,
    }
  `;

  const refs = traverseTest(src, module1);
  const exp = refs[1] as TextRef;
  expect(exp.kind).toBe("txt");
  expect(exp.elem.kind).toBe("struct");
  expect(exp.elem.name).toBe("AStruct");
});

test("traverse simple gleam style import", () => {
  const main = `
    import bar/foo;
    fn main() { foo(); }
  `;
  const bar = `
    module bar
    export fn foo() { }
  `;
  const refs = traverseTest(main, bar);
  const exp = refs[1] as TextRef;
  expect(exp.kind).toBe("txt");
  expect(exp.elem.kind).toBe("fn");
  expect(exp.elem.name).toBe("foo");
});

test("traverse nested import with params and support fn", () => {
  const src = `
    import foo(u32) from ./file1
    fn bar() {
      foo(8u);
    }
  `;

  const module1 = `
    import zap from ./file2
  
    export (A)
    fn foo(a: A) { 
      support(a);
      zap();
    }

    fn support() {}
  `;

  const module2 = `
    export 
    fn zap() {}
  `;

  const refs = traverseTest(src, module1, module2);
  const first = refs[1] as TextRef;
  const second = refs[2] as TextRef;
  expect(first.kind).toBe("txt");
  expect(first.expInfo?.expImpArgs).toEqual([["A", "u32"]]);
  expect(second.kind).toBe("txt");
  expect(second.elem.name).toBe("support");
});

test("mismatched import export params", () => {
  const src = `
    #import foo(A, B) from ./file1
    fn main() {
      foo(k, l);
    } `;
  const module1 = `
    #export(C) 
    fn foo(c:C) { } `;

  const { log } = traverseWithLog(src, module1);
  expect(log).toMatchInlineSnapshot(`
    "mismatched import and export params  module: _root/main.wgsl
        #import foo(A, B) from ./file1   Ln 2
        ^
     module: _root/file1.wgsl
        #export(C)    Ln 2
        ^"
  `);
});

test("traverse var to gleam style struct ref", () => {
  const main = `
     import foo/Bar;
     var x: Bar;
     fn main() { }
   `;
  const foo = `
      module foo
      export struct Bar { f: f32 }
   `;

  const refs = traverseTest(main, foo);
  const structRef = refs.find(
    ref => ref.kind === "txt" && ref.elem.kind === "struct",
  );
  expect(structRef).toBeDefined();
});

test("traverse a struct to struct ref", () => {
  const src = `
    #import AStruct from ./file1

    struct SrcStruct {
      a: AStruct,
    }
  `;
  const module1 = `
    #export
    struct AStruct {
      x: u32,
    }
  `;

  const refs = traverseTest(src, module1);
  expect(refs[1].kind).toBe("txt");
  expect(refName(refs[1])).toBe("AStruct");
});

test("traverse a global var to struct ref", () => {
  const src = `
    #import Uniforms from ./file1

    @group(0) @binding(0) var<uniform> u: Uniforms;      
    `;
  const module1 = `
    #export
    struct Uniforms {
      model: mat4x4<f32>,
    }
  `;

  const refs = traverseTest(src, module1);
  const exp = refs[1] as TextRef;
  expect(exp.kind).toBe("txt");
  expect(exp.elem.kind).toBe("struct");
  expect(exp.elem.name).toBe("Uniforms");
});

test("traverse transitive struct refs", () => {
  const src = `
    #import AStruct  from ./file1

    struct SrcStruct {
      a: AStruct,
    }
  `;
  const module1 = `
    #import BStruct from ./file2

    #export
    struct AStruct {
      s: BStruct,
    }
  `;
  const module2 = `
    #export
    struct BStruct {
      x: u32,
    }
  `;

  const refs = traverseTest(src, module1, module2);
  expect(refName(refs[1])).toBe("AStruct");
  expect(refName(refs[2])).toBe("BStruct");
});

test("traverse ref from struct constructor", () => {
  const src = `
    #import AStruct from ./file1

    fn main() {
      var x = AStruct(1u);
    }
  `;
  const module1 = `
    #export
    struct AStruct {
      b: u32
    }
  `;

  const refs = traverseTest(src, module1);
  expect(refName(refs[1])).toBe("AStruct");
});

test("traverse with local support struct", () => {
  const src = `
    #import A from ./file1

    fn b() { var a: A; var b: B; }

    struct B { x: u32 }
  `;
  const module1 = `
    #export
    struct A { y: i32 }
  `;

  const refs = traverseTest(src, module1);
  const refNames = refs.map(refName);
  expect(refNames).toEqual(["B", "b", "A"]);
});

test("traverse from return type of function", () => {
  const src = `
    #import A from ./file1

    fn b() -> A { }
  `;
  const module1 = `
    #export
    struct A { y: i32 }
  `;

  const refs = traverseTest(src, module1);
  const refNames = refs.map(refName);
  expect(refNames).toEqual(["b", "A"]);
});

test("traverse skips built in fn and type", () => {
  const src = `
    fn foo() {
      bar();
      min(3,4);
      vec3(u);
    }
    fn bar() {}
  `;

  const { refs, log } = traverseWithLog(src);
  const refNames = refs.map(refName);
  // refs.map(r => refLog(r));
  expect(refNames).toEqual(["foo", "bar"]);
  expect(log).toBe("");
});

test("type inside fn with same name as fn", () => {
  // this will fail wgsl compilation, but as long as it doesn't hang the linker, we're ok
  const src = `
    fn foo() {
      let a:foo;
    }
    fn bar() {}
  `;
  const { refs, log } = traverseWithLog(src);
  expect(log).toBe("");
  expect(refs.length).toBe(2);
});

test("call inside fn with same name as fn", () => {
  const src = `
    fn foo() {
      foo();
    }
  `;
  const { refs, log } = traverseWithLog(src);
  expect(refs.length).toBe(1);
  expect(log).toBe("");
});

test("call cross reference", () => {
  const src = `
    fn foo() {
      bar();
    }

    fn bar() {
      foo();
    }
  `;
  const { refs, log } = traverseWithLog(src);
  const refNames = refs.map(r => (r as TextRef).elem.name);
  expect(refNames).toContain("foo");
  expect(refNames).toContain("bar");
  expect(refNames.length).toBe(2);
  expect(log).toBe("");
});

test("struct self reference", () => {
  const src = `
    struct A {
      a: A,
      b: B,
    }
    struct B {
      f: f32,
    }
  `;
  const { log } = traverseWithLog(src);
  expect(log).toBe("");
});

test("struct cross reference", () => {
  const src = `
    struct A {
      b: B,
    }
    struct B {
      a: A,
    }
  `;
  const { refs, log } = traverseWithLog(src);
  expect(log).toBe("");
  const refNames = refs.map(r => (r as any).elem.name);
  expect(refNames).toContain("A");
  expect(refNames).toContain("B");
  expect(refNames.length).toBe(2);
});

test("parse texture_storage_2d with texture format in type position", () => {
  const src = `var t: texture_storage_2d<rgba8unorm, write>;`;
  const { log } = traverseWithLog(src);
  expect(log).toBe("");
});

/** run traverseRefs with no filtering and return the refs and the error log output */
function traverseWithLog(
  src: string,
  ...modules: string[]
): { refs: FoundRef[]; log: string } {
  const { log, logged } = logCatch();
  const refs = _withBaseLogger(log, () => traverseTest(src, ...modules));

  return { refs, log: logged() };
}

/** run traverseRefs on the provided wgsl source strings
 * the first module is treated as the root
 */
function traverseTest(src: string, ...modules: string[]): FoundRef[] {
  const moduleFiles = Object.fromEntries(
    modules.map((m, i) => [`./file${i + 1}.wgsl`, m]),
  );
  const wgsl = { "./main.wgsl": src, ...moduleFiles };
  const registry = new ModuleRegistry({ wgsl });
  const refs: FoundRef[] = [];
  const parsed = registry.parsed();
  const mainModule = parsed.findTextModule("./main")!;
  const seen = new Set<string>();

  traverseRefs(mainModule, parsed, ref => {
    if (unseen(ref)) {
      refs.push(ref);
      return true;
    }
  });

  function unseen(ref: FoundRef): true | undefined {
    const fullName = refFullName(ref);
    if (!seen.has(fullName)) {
      seen.add(fullName);
      return true;
    }
  }

  return refs;
}
