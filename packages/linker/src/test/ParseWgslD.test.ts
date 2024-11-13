import { or, repeat, _withBaseLogger } from "mini-parse";
import { expectNoLogErr, logCatch } from "mini-parse/test-util";

import { dlog } from "berry-pretty";
import { expect, test } from "vitest";
import { AbstractElem, FnElem, StructElem, VarElem } from "../AbstractElems.js";
import { filterElems } from "../ParseModule.js";
import { unknown, wordNumArgs } from "../ParseSupport.js";
import {
  fnDecl,
  globalVar,
  parseWgslD,
  structDecl,
  typeSpecifier,
} from "../ParseWgslD.js";
import { testAppParse } from "./TestUtil.js";

function testParseWgsl(src: string): AbstractElem[] {
  return parseWgslD(src, undefined, {}, 500);
}

test("parse empty string", () => {
  const parsed = testParseWgsl("");
  expect(parsed).toMatchSnapshot();
});

test("parse fn foo() { }", () => {
  const src = "fn foo() { }";
  const parsed = testParseWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("parse fn with calls", () => {
  const src = "fn foo() { foo(); bar(); }";
  const parsed = testParseWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("structDecl parses struct member types", () => {
  const src = "struct Foo { a: f32, b: i32 }";
  const { appState } = testAppParse(structDecl, src);
  const { members } = appState[0] as StructElem;
  const typeNames = members.flatMap(m => m.typeRefs.map(t => t.name));
  expect(typeNames).toEqual(["f32", "i32"]);
});

test("parse struct", () => {
  const src = "struct Foo { a: f32, b: i32 }";
  const parsed = testParseWgsl(src);
  expect(parsed).toMatchInlineSnapshot(`
    [
      {
        "end": 29,
        "kind": "struct",
        "members": [
          {
            "end": 19,
            "kind": "member",
            "name": "a",
            "start": 13,
            "typeRefs": [
              {
                "end": 19,
                "kind": "typeRef",
                "name": "f32",
                "start": 16,
              },
            ],
          },
          {
            "end": 27,
            "kind": "member",
            "name": "b",
            "start": 21,
            "typeRefs": [
              {
                "end": 27,
                "kind": "typeRef",
                "name": "i32",
                "start": 24,
              },
            ],
          },
        ],
        "name": "Foo",
        "nameElem": {
          "end": 10,
          "kind": "typeName",
          "name": "Foo",
          "start": 7,
        },
        "start": 0,
      },
    ]
  `);
});

test("parse @attribute before fn", () => {
  const src = `
    @compute 
    fn main() {}
    `;
  const parsed = testParseWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("wordNumArgs parses (a, b, 1)", () => {
  const src = `(a, b, 1)`;
  const { parsed } = testAppParse(wordNumArgs, src);
  expect(parsed?.value).toMatchSnapshot();
});

test("parse @compute @workgroup_size(a, b, 1) before fn", () => {
  const src = `
    @compute 
    @workgroup_size(a, b, 1) 
    fn main() {}
    `;
  const parsed = testParseWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("parse global diagnostic", () => {
  const src = `
    diagnostic(off,derivative_uniformity);

    fn main() {}
    `;
  expectNoLogErr(() => {
    const parsed = testParseWgsl(src);
    expect(parsed).toMatchSnapshot();
  });
});

test("parse const_assert", () => {
  const src = `
    const_assert x < y;

    fn main() {}
    `;
  expectNoLogErr(() => {
    const parsed = testParseWgsl(src);
    expect(parsed).toMatchSnapshot();
  });
});

test("parse top level var", () => {
  const src = `
    @group(0) @binding(0) var<uniform> u: Uniforms;      

    fn main() {}
  `;
  expectNoLogErr(() => {
    const parsed = testParseWgsl(src);
    expect(parsed).toMatchSnapshot();
  });
});

test("parse top level override and const", () => {
  const src = `
    override x = 21;
    const y = 1;

    fn main() {}
  `;
  expectNoLogErr(() => {
    const parsed = testParseWgsl(src);
    expect(parsed).toMatchSnapshot();
  });
});

test("parse root level ;;", () => {
  const src = ";;";
  expectNoLogErr(() => {
    const parsed = testParseWgsl(src);
    expect(parsed).toMatchSnapshot();
  });
});

test("parse simple alias", () => {
  const src = `alias NewType = OldType;`;
  expectNoLogErr(() => {
    const parsed = testParseWgsl(src);
    expect(parsed).toMatchSnapshot();
  });
});

test("parse array alias", () => {
  const src = `
    alias Points3 = array<Point, 3>;
  `;
  expectNoLogErr(() => {
    const parsed = testParseWgsl(src);
    expect(parsed).toMatchSnapshot();
  });
});

test("unexpected token", () => {
  const p = repeat(or("a", unknown));
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => testAppParse(p, "a b"));
  expect(logged()).toMatchInlineSnapshot(`
    "??? word: 'b'  repeat > or > map
    a b   Ln 1
      ^"
  `);
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

  const { parsed } = testAppParse(typeSpecifier, src);
  expect(parsed?.value[0].name).toBe("array");
  expect(parsed?.value[1].name).toBe("MyStruct");
  expect(parsed?.value.length).toBe(2);
});

test("parse vec templated type", () => {
  const src = `vec2<f32>`;

  const { parsed } = testAppParse(typeSpecifier, src);
  expect(parsed?.value[0].name).toBe("vec2");
  expect(parsed?.value[1].name).toBe("f32");
  expect(parsed?.value.length).toBe(2);
});

test("parse template ending with >=", () => {
  const src = `
  var foo: vec2<f32 >= vec2( 0.5, -0.5);`;

  const { parsed } = testAppParse(globalVar, src);
  expect(parsed).not.toBeNull();
});

test("parse nested template that ends with >> ", () => {
  const src = `vec2<array <MyStruct,4>>`;

  const { parsed } = testAppParse(typeSpecifier, src);
  const typeRefNames = parsed?.value.map(r => r.name);
  expect(typeRefNames).toEqual(["vec2", "array", "MyStruct"]);
});

test("parse struct member with templated type", () => {
  const src = `struct Foo { a: vec2<array<Bar,4>> }`;
  const { appState } = testAppParse(structDecl, src);
  const members = filterElems<StructElem>(appState, "struct")[0].members;
  const memberNames = members.flatMap(m => m.typeRefs.map(t => t.name));
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

test("parse foo::bar(); ", () => {
  const src = "fn main() { foo::bar(); }";
  const parsed = testParseWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("parse foo.bar(); ", () => {
  const src = "fn main() { foo.bar(); }";
  const parsed = testParseWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("parse let x: foo::bar; ", () => {
  const src = "fn main() { let x: foo::bar = 1; }";
  const parsed = testParseWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("parse let x: foo.bar; ", () => {
  const src = "fn main() { let x: foo.bar = 1; }";
  const parsed = testParseWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test("parse var x: foo.bar;", () => {
  const src = `
     import foo/bar;
     var x: foo.bar;
     fn main() { }
  `;
  const parsed = testParseWgsl(src);

  const varRef = parsed.find(e => e.kind === "var");
  expect(varRef?.typeRefs[0].name).toBe("foo.bar");
});

test("parse switch statement", () => {
  const src = `
    fn main(x: i32) {
      switch (x) {
        case 1: { break; }
        default: { break; }
      }
    }
  `;
  const parsed = testParseWgsl(src);
  expect(parsed).toMatchSnapshot();
});

test.skip("parse switch statement-2", () => {
  const src = `

    fn main(x: u32) {
      switch ( code ) {
        case 5u: { if 1 > 0 { } }
        default: { break; }
      }
    }
  `;
  const parsed = testParseWgsl(src);
  dlog({ parsed });
  // expect(parsed).toMatchSnapshot();
  expect.fail();
});
