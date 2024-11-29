import { _withBaseLogger } from "mini-parse";
import { logCatch } from "mini-parse/test-util";
import { expect, test } from "vitest";
import { refFullName } from "../Linker.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { FoundRef, TextRef, traverseRefs } from "../TraverseRefs.js";

test("traverse a fn to struct ref", () => {
  const src = `
    import ./file1/AStruct;

    fn main() {
      var a:AStruct; 
    }
  `;
  const module1 = `
    export struct AStruct {
      x: u32,
    }
  `;

  const refs = traverseTest(src, module1); //?
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
    import ./file1/AStruct;

    struct SrcStruct {
      a: AStruct,
    }
  `;
  const module1 = `
    export struct AStruct {
      x: u32,
    }
  `;

  const refs = traverseTest(src, module1);
  expect(refs[1].kind).toBe("txt");
  expect(refs[1].elem.name).toBe("AStruct");
});

test("traverse a global var to struct ref", () => {
  const src = `
    import ./file1/Uniforms;

    @group(0) @binding(0) var<uniform> u: Uniforms;      
    `;
  const module1 = `
    export struct Uniforms {
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
    import ./file1/AStruct

    struct SrcStruct {
      a: AStruct,
    }
  `;
  const module1 = `
    import ./file2/BStruct

    export
    struct AStruct {
      s: BStruct,
    }
  `;
  const module2 = `
    export
    struct BStruct {
      x: u32,
    }
  `;

  const refs = traverseTest(src, module1, module2);
  expect(refs[1].elem.name).toBe("AStruct");
  expect(refs[2].elem.name).toBe("BStruct");
});

// TODO The issue is that the traverse relies on finding a TypeRef entry in main for AStruct()
// but the current grammar makes it a bit tricky to create that TypeRef.
// we could fix the grammar, but also we might revise the linker to not need TypeRefs soon
// so marking skip for now
test.skip("traverse ref from struct constructor", () => {
  const src = `
    import ./file1/AStruct

    fn main() {
      var x = AStruct(1u);
    }
  `;
  const module1 = `
    export struct AStruct {
      b: u32
    }
  `;

  const refs = traverseTest(src, module1); 
  const elemNames = refs.map(r => r.elem.name)
  expect(elemNames).toEqual(["main", "AStruct"]);
});

test("traverse with local support struct", () => {
  const src = `
    import ./file1/A

    fn b() { var a: A; var b: B; }

    struct B { x: u32 }
  `;
  const module1 = `
    export
    struct A { y: i32 }
  `;

  const refs = traverseTest(src, module1);
  const refNames = refs.map(r => r.elem.name);
  expect(refNames).toEqual(["B", "b", "A"]);
});

test("traverse from return type of function", () => {
  const src = `
    import ./file1/A

    fn b() -> A { }
  `;
  const module1 = `
    #export
    struct A { y: i32 }
  `;

  const refs = traverseTest(src, module1);
  const refNames = refs.map(r => r.elem.name);
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
  const refNames = refs.map(r => r.elem.name);
  // refs.map(r => refLog(r));
  expect(refNames).toEqual(["foo", "bar"]);
  expect(log).toBe("");
});

test("type inside fn with same name as fn", () => {
  // this will fail wgsl compilation, but as long as it doesn't hang the linker, we're ok
  const src = `
    fn foo() {
      var a:foo;
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
