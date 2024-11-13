import { _withBaseLogger, or, repeat } from "@wesl/mini-parse";
import { expectNoLogErr, logCatch } from "@wesl/mini-parse/test-util";

import { expect, test } from "vitest";
import { assertSnapshot } from "@std/testing/snapshot";
import type {
  AbstractElem,
  FnElem,
  StructElem,
  VarElem,
} from "../AbstractElems.ts";
import { filterElems } from "../ParseModule.ts";
import { unknown, wordNumArgs } from "../ParseSupport.ts";
import {
  fnDecl,
  globalVar,
  parseWgslD,
  structDecl,
  type_specifier,
} from "../ParseWgslD.ts";
import { testAppParse } from "./TestUtil.ts";

function testParseWgsl(src: string): AbstractElem[] {
  return parseWgslD(src, undefined, {}, 500);
}

test("parse empty string", async (ctx) => {
  const parsed = testParseWgsl("");
  await assertSnapshot(ctx, parsed);
});

test("parse fn foo() { }", async (ctx) => {
  const src = "fn foo() { }";
  const parsed = testParseWgsl(src);
  await assertSnapshot(ctx, parsed);
});

test("parse fn with calls", async (ctx) => {
  const src = "fn foo() { foo(); bar(); }";
  const parsed = testParseWgsl(src);
  await assertSnapshot(ctx, parsed);
});

test("structDecl parses struct member types", () => {
  const src = "struct Foo { a: f32, b: i32 }";
  const { appState } = testAppParse(structDecl, src);
  const { members } = appState[0] as StructElem;
  const typeNames = members.flatMap((m) => m.typeRefs.map((t) => t.name));
  expect(typeNames).toEqual(["f32", "i32"]);
});

test("parse struct", async (ctx) => {
  const src = "struct Foo { a: f32, b: i32 }";
  const parsed = testParseWgsl(src);
  await assertSnapshot(ctx, parsed);
});

test("parse @attribute before fn", async (ctx) => {
  const src = `
    @compute 
    fn main() {}
    `;
  const parsed = testParseWgsl(src);
  await assertSnapshot(ctx, parsed);
});

test("wordNumArgs parses (a, b, 1)", async (ctx) => {
  const src = `(a, b, 1)`;
  const { parsed } = testAppParse(wordNumArgs, src);
  await assertSnapshot(ctx, parsed?.value);
});

test("parse @compute @workgroup_size(a, b, 1) before fn", async (ctx) => {
  const src = `
    @compute 
    @workgroup_size(a, b, 1) 
    fn main() {}
    `;
  const parsed = testParseWgsl(src);
  await assertSnapshot(ctx, parsed);
});

test("parse global diagnostic", async (ctx) => {
  const src = `
    diagnostic(off,derivative_uniformity);

    fn main() {}
    `;
  await expectNoLogErr(async () => {
    const parsed = testParseWgsl(src);
    await assertSnapshot(ctx, parsed);
  });
});

test("parse const_assert", async (ctx) => {
  const src = `
    const_assert x < y;

    fn main() {}
    `;
  await expectNoLogErr(async () => {
    const parsed = testParseWgsl(src);
    await assertSnapshot(ctx, parsed);
  });
});

test("parse top level var", async (ctx) => {
  const src = `
    @group(0) @binding(0) var<uniform> u: Uniforms;      

    fn main() {}
  `;
  await expectNoLogErr(async () => {
    const parsed = testParseWgsl(src);
    await assertSnapshot(ctx, parsed);
  });
});

test("parse top level override and const", async (ctx) => {
  const src = `
    override x = 21;
    const y = 1;

    fn main() {}
  `;
  await expectNoLogErr(async () => {
    const parsed = testParseWgsl(src);
    await assertSnapshot(ctx, parsed);
  });
});

test("parse root level ;;", async (ctx) => {
  const src = ";;";
  await expectNoLogErr(async () => {
    const parsed = testParseWgsl(src);
    await assertSnapshot(ctx, parsed);
  });
});

test("parse simple alias", async (ctx) => {
  const src = `alias NewType = OldType;`;
  await expectNoLogErr(async () => {
    const parsed = testParseWgsl(src);
    await assertSnapshot(ctx, parsed);
  });
});

test("parse array alias", async (ctx) => {
  const src = `
    alias Points3 = array<Point, 3>;
  `;
  await expectNoLogErr(async () => {
    const parsed = testParseWgsl(src);
    await assertSnapshot(ctx, parsed);
  });
});

test("unexpected token", async (ctx) => {
  const p = repeat(or("a", unknown));
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => testAppParse(p, "a b"));
  await assertSnapshot(ctx, logged());
});

test("fnDecl parses fn with return type", () => {
  const src = `
    fn foo() -> MyType { }
  `;
  const { appState } = testAppParse(fnDecl, src);
  expect((appState[0] as FnElem).typeRefs[0].name).toBe("MyType");
});

test("fnDecl parses :type specifier in fn args", () => {
  const src = `
    fn foo(a: MyType) { }
  `;
  const { appState } = testAppParse(fnDecl, src);
  const { typeRefs } = appState[0] as FnElem;
  expect(typeRefs[0].name).toBe("MyType");
});

test("fnDecl parses :type specifier in fn block", () => {
  const src = `
    fn foo() { 
      var b:MyType;
    }
  `;
  const { appState } = testAppParse(fnDecl, src);
  expect((appState[0] as FnElem).typeRefs[0].name).toBe("MyType");
});

test("parse type in <template> in fn args", () => {
  const src = `
    fn foo(a: vec2<MyStruct>) { };`;

  const { appState } = testAppParse(fnDecl, src);
  const { typeRefs } = appState[0] as FnElem;
  expect(typeRefs[0].name).toBe("vec2");
  expect(typeRefs[1].name).toBe("MyStruct");
});

test("parse simple templated type", () => {
  const src = `array<MyStruct,4>`;

  const { parsed } = testAppParse(type_specifier, src);
  expect(parsed?.value[0].name).toBe("array");
  expect(parsed?.value[1].name).toBe("MyStruct");
  expect(parsed?.value.length).toBe(2);
});

test("parse nested template that ends with >> ", () => {
  const src = `vec2<array <MyStruct,4>>`;

  const { parsed } = testAppParse(type_specifier, src);
  const typeRefNames = parsed?.value.map((r) => r.name);
  expect(typeRefNames).toEqual(["vec2", "array", "MyStruct"]);
});

test("parse struct member with templated type", () => {
  const src = `struct Foo { a: vec2<array<Bar,4>> }`;
  const { appState } = testAppParse(structDecl, src);
  const members = filterElems<StructElem>(appState, "struct")[0].members;
  const memberNames = members.flatMap((m) => m.typeRefs.map((t) => t.name));
  expect(memberNames).toEqual(["vec2", "array", "Bar"]);
});

test("parse type in <template> in global var", () => {
  const src = `
    var x:vec2<MyStruct> = { x: 1, y: 2 };`;

  const { appState } = testAppParse(globalVar, src);
  const typeRefs = (appState[0] as VarElem).typeRefs;
  expect(typeRefs[0].name).toBe("vec2");
  expect(typeRefs[1].name).toBe("MyStruct");
});

test("parse for(;;) {} not as a fn call", () => {
  const src = `
    fn main() {
      for (var a = 1; a < 10; a++) {}
    }
  `;
  const appState = testParseWgsl(src);
  const fnElem = filterElems<FnElem>(appState, "fn")[0];
  expect(fnElem).toBeDefined();
  expect(fnElem.calls.length).toBe(0);
});

test("eolf followed by blank line", () => {
  const src = `
    export fn foo() { }
  `;
  expectNoLogErr(() => testParseWgsl(src));
});

test("parse fn with attributes and suffix comma", () => {
  const src = `
  @compute
  @workgroup_size(workgroupThreads, 1, 1) 
  fn main(
      @builtin(global_invocation_id) grid: vec3<u32>,
      @builtin(local_invocation_index) localIndex: u32,  
  ) { }
  `;
  expectNoLogErr(() => {
    const parsed = testParseWgsl(src);
    const first = parsed[0] as FnElem;
    expect(first.kind).toBe("fn");
    expect(first.name).toBe("main");
  });
});

test("parse foo::bar(); ", async (ctx) => {
  const src = "fn main() { foo::bar(); }";
  const parsed = testParseWgsl(src);
  await assertSnapshot(ctx, parsed);
});

test("parse foo.bar(); ", async (ctx) => {
  const src = "fn main() { foo.bar(); }";
  const parsed = testParseWgsl(src);
  await assertSnapshot(ctx, parsed);
});

test("parse let x: foo::bar; ", async (ctx) => {
  const src = "fn main() { let x: foo::bar = 1; }";
  const parsed = testParseWgsl(src);
  await assertSnapshot(ctx, parsed);
});

test("parse let x: foo.bar; ", async (ctx) => {
  const src = "fn main() { let x: foo.bar = 1; }";
  const parsed = testParseWgsl(src);
  await assertSnapshot(ctx, parsed);
});

test("parse var x: foo.bar;", () => {
  const src = `
     import foo/bar;
     var x: foo.bar;
     fn main() { }
  `;
  const parsed = testParseWgsl(src);

  const varRef = parsed.find((e) => e.kind === "var");
  expect(varRef?.typeRefs[0].name).toBe("foo.bar");
});

test("parse switch statement", async (ctx) => {
  const src = `
    fn main(x: i32) {
      switch (x) {
        case 1: { break; }
        default: { break; }
      }
    }
  `;
  const parsed = testParseWgsl(src);
  await assertSnapshot(ctx, parsed);
});

test.ignore("parse switch statement-2", () => {
  const src = `

    fn main(x: u32) {
      switch ( code ) {
        case 5u: { if 1 > 0 { } }
        default: { break; }
      }
    }
  `;
  const parsed = testParseWgsl(src);
  // dlog({ parsed });
  // expect(parsed).toMatchSnapshot();
  // expect.fail();
});
