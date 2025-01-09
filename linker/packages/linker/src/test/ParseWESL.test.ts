import { expect, test } from "vitest";
import { astTree } from "../debug/ASTLogging.ts";
import { parse2Test } from "./TestUtil.ts";
import { importToString } from "../debug/ImportToString.ts";

test("parse empty string", () => {
  const ast = parse2Test("");
  expect(astTree(ast.moduleElem)).toMatchInlineSnapshot(`"module"`);
});

test("parse fn foo() { }", () => {
  const src = "fn foo() { }";
  const ast = parse2Test(src);
  expect(astTree(ast.moduleElem)).toMatchInlineSnapshot(`
    "module
      fn foo()
        text 'fn '
        decl %foo
        text '() { }'"
  `);
});

test("parse fn with calls", () => {
  const src = "fn foo() { foo(); bar(); }";
  const ast = parse2Test(src);
  expect(astTree(ast.moduleElem)).toMatchInlineSnapshot(`
    "module
      fn foo()
        text 'fn '
        decl %foo
        text '() { '
        ref foo
        text '(); '
        ref bar
        text '(); }'"
  `);
});

test("parse unicode ident", () => {
  // List taken straight from the examples at https://www.w3.org/TR/WGSL/#identifiers
  const src = `
  fn Δέλτα(){} 
  fn réflexion(){} 
  fn Кызыл(){} 
  fn 𐰓𐰏𐰇(){} 
  fn 朝焼け(){}
  fn سلام(){} 
  fn 검정(){} 
  fn שָׁלוֹם(){}
  fn गुलाबी(){}
  fn փիրուզ(){}
  `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchSnapshot();
});

test("parse global var", () => {
  const src = `var x: i32 = 1;`;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      gvar x:i32
        text 'var '
        decl %x
        text ': '
        ref i32
        text ' = 1;'"
  `);
});

test("parse alias", () => {
  const src = `alias Num = i32;`;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      alias %Num=i32
        text 'alias '
        decl %Num
        text ' = '
        ref i32
        text ';'"
  `);
});

test("parse const", () => {
  const src = `const y = 11u;`;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      const y
        text 'const '
        decl %y
        text ' = 11u;'"
  `);
});

test("parse override ", () => {
  const src = `override z: f32;`;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      override z:f32
        text 'override '
        decl %z
        text ': '
        ref f32
        text ';'"
  `);
});

test("parse const_assert", () => {
  const src = `const_assert x < y;`;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      assert
        text 'const_assert '
        ref x
        text ' < '
        ref y
        text ';'"
  `);
});

test("parse struct", () => {
  const src = `struct foo { bar: i32, zip: u32, } ;`;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      struct foo
        text 'struct '
        decl %foo
        text ' { '
        member
          name bar
          text ': '
          ref i32
        text ', '
        member
          name zip
          text ': '
          ref u32
        text ', }'
      text ' ;'"
  `);
});

test("parse global diagnostic", () => {
  const src = `
    diagnostic(off,derivative_uniformity);

    fn main() {}
    `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        diagnostic(off,derivative_uniformity);

        '
      fn main()
        text 'fn '
        decl %main
        text '() {}'
      text '
        '"
  `);
});

test("parse @attribute before fn", () => {
  const src = `@compute fn main() {} `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      fn main()
        text '@compute fn '
        decl %main
        text '() {}'
      text ' '"
  `);
});

test("parse @compute @workgroup_size(a, b, 1) before fn", () => {
  const src = `
    @compute 
    @workgroup_size(a, b, 1) 
    fn main() {}
    `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        '
      fn main()
        text '@compute 
        @workgroup_size('
        ref a
        text ', '
        ref b
        text ', 1) 
        fn '
        decl %main
        text '() {}'
      text '
        '"
  `);
});

test("parse top level var", () => {
  const src = `
    @group(0) @binding(0) var<uniform> u: Uniforms;      

    fn main() {}
  `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        '
      gvar u:Uniforms
        text '@group(0) @binding(0) var<uniform> '
        decl %u
        text ': '
        ref Uniforms
        text ';'
      text '      

        '
      fn main()
        text 'fn '
        decl %main
        text '() {}'
      text '
      '"
  `);
});

test("parse top level override and const", () => {
  const src = `
    override x = 21;
    const y = 1;

    fn main() {}
  `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        '
      override x
        text 'override '
        decl %x
        text ' = 21;'
      text '
        '
      const y
        text 'const '
        decl %y
        text ' = 1;'
      text '

        '
      fn main()
        text 'fn '
        decl %main
        text '() {}'
      text '
      '"
  `);
});

test("parse root level ;;", () => {
  const src = ";;";
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text ';;'"
  `);
});

test("parse simple alias", () => {
  const src = `alias NewType = OldType;`;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      alias %NewType=OldType
        text 'alias '
        decl %NewType
        text ' = '
        ref OldType
        text ';'"
  `);
});

test("parse array alias", () => {
  const src = `
    alias Points3 = array<Point, 3>;
  `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        '
      alias %Points3=array
        text 'alias '
        decl %Points3
        text ' = '
        ref array
        text '<'
        ref Point
        text ', 3>;'
      text '
      '"
  `);
});

test("fnDecl parses fn with return type", () => {
  const src = `fn foo() -> MyType { }`;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      fn foo() -> MyType
        text 'fn '
        decl %foo
        text '() -> '
        ref MyType
        text ' { }'"
  `);
});

test("fnDecl parses :type specifier in fn args", () => {
  const src = `
    fn foo(a: MyType) { }
  `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        '
      fn foo(a: MyType)
        text 'fn '
        decl %foo
        text '('
        param
          decl %a
          text ': '
          ref MyType
        text ') { }'
      text '
      '"
  `);
});

test("fnDecl parses :type specifier in fn block", () => {
  const src = `
    fn foo() { 
      var b:MyType;
    }
  `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        '
      fn foo()
        text 'fn '
        decl %foo
        text '() { 
          '
        var b:MyType
          text 'var '
          decl %b
          text ':'
          ref MyType
        text ';
        }'
      text '
      '"
  `);
});

test("parse type in <template> in fn args", () => {
  const src = `
    fn foo(a: vec2<MyStruct>) { };`;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        '
      fn foo(a: vec2)
        text 'fn '
        decl %foo
        text '('
        param
          decl %a
          text ': '
          ref vec2
          text '<'
          ref MyStruct
          text '>'
        text ') { }'
      text ';'"
  `);
});

test("parse simple templated type", () => {
  const src = `fn main(a: array<MyStruct,4>) { }`;

  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      fn main(a: array)
        text 'fn '
        decl %main
        text '('
        param
          decl %a
          text ': '
          ref array
          text '<'
          ref MyStruct
          text ',4>'
        text ') { }'"
  `);
});

test("parse nested template that ends with >> ", () => {
  const src = `fn main(a: vec2<array <MyStruct,4>>) { }`;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      fn main(a: vec2)
        text 'fn '
        decl %main
        text '('
        param
          decl %a
          text ': '
          ref vec2
          text '<'
          ref array
          text ' <'
          ref MyStruct
          text ',4>>'
        text ') { }'"
  `);
});

test("parse type in <template> in global var", () => {
  const src = `var<private> x:array<MyStruct, 8>;`;

  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      gvar x:array
        text 'var<private> '
        decl %x
        text ':'
        ref array
        text '<'
        ref MyStruct
        text ', 8>;'"
  `);
});

test("parse for(;;) {} not as a fn call", () => {
  const src = `
    fn main() {
      for (var a = 1; a < 10; a++) {}
    }
  `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        '
      fn main()
        text 'fn '
        decl %main
        text '() {
          for ('
        var a
          text 'var '
          decl %a
          text ' = 1'
        text '; '
        ref a
        text ' < 10; '
        ref a
        text '++) {}
        }'
      text '
      '"
  `);
});

test("eolf followed by blank line", () => {
  const src = `
    export fn foo() { }
  `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        export '
      fn foo()
        text 'fn '
        decl %foo
        text '() { }'
      text '
      '"
  `);
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
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
      '
      fn main(grid: vec3, localIndex: u32)
        text '@compute
      @workgroup_size('
        ref workgroupThreads
        text ', 1, 1) 
      fn '
        decl %main
        text '(
          '
        param
          text '@builtin(global_invocation_id) '
          decl %grid
          text ': '
          ref vec3
          text '<'
          ref u32
          text '>'
        text ',
          '
        param
          text '@builtin(local_invocation_index) '
          decl %localIndex
          text ': '
          ref u32
        text ',  
      ) { }'
      text '
      '"
  `);
});

test("parse fn", () => {
  const src = `fn foo(x: i32, y: u32) -> f32 { return 1.0; }`;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      fn foo(x: i32, y: u32) -> f32
        text 'fn '
        decl %foo
        text '('
        param
          decl %x
          text ': '
          ref i32
        text ', '
        param
          decl %y
          text ': '
          ref u32
        text ') -> '
        ref f32
        text ' { return 1.0; }'"
  `);
});

test("parse @attribute before fn", () => {
  const src = `@compute fn main() {} `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      fn main()
        text '@compute fn '
        decl %main
        text '() {}'
      text ' '"
  `);
});

test("import ./foo/bar;", ctx => {
  const src = ctx.task.name;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      import package/foo/bar
        text 'import ./foo/bar;'"
  `);
});

// TODO
test.skip("parse foo::bar(); ", () => {
  const src = "fn main() { foo::bar(); }";
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot();
});

// TODO
test.skip("parse let x: foo::bar; ", () => {
  const src = "fn main() { let x: foo::bar = 1; }";
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot();
});

// TODO (consdier should this be legal?)
test.skip("parse var x: foo.bar;", () => {
  const src = `
     import foo::bar;
     var<private> x: foo::bar;
     fn main() { }
  `;

  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot();
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
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        '
      fn main(x: i32)
        text 'fn '
        decl %main
        text '('
        param
          decl %x
          text ': '
          ref i32
        text ') {
          switch ('
        ref x
        text
           ') {
            case 1: { break; }
            default: { break; }
          }
        }'
      text '
      '"
  `);
});

test("parse switch statement-2", () => {
  const src = `

    fn main(x: u32) {
      switch ( code ) {
        case 5u: { if 1 > 0 { } }
        default: { break; }
      }
    }
  `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '

        '
      fn main(x: u32)
        text 'fn '
        decl %main
        text '('
        param
          decl %x
          text ': '
          ref u32
        text ') {
          switch ( '
        ref code
        text
           ' ) {
            case 5u: { if 1 > 0 { } }
            default: { break; }
          }
        }'
      text '
      '"
  `);
});

test("parse struct constructor in assignment", () => {
  const src = `
    fn main() {
      var x = AStruct(1u);
    }
   `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        '
      fn main()
        text 'fn '
        decl %main
        text '() {
          '
        var x
          text 'var '
          decl %x
          text ' = '
          ref AStruct
          text '(1u)'
        text ';
        }'
      text '
       '"
  `);
});

test("parse struct.member (component_or_swizzle)", () => {
  const src = `
    fn main() {
        let x = u.frame;
    }
  `;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      text '
        '
      fn main()
        text 'fn '
        decl %main
        text '() {
            let '
        decl %x
        text ' = '
        ref u
        text '.frame;
        }'
      text '
      '"
  `);
});

test("var <workgroup> work: array<u32, 128>;", ctx => {
  const ast = parse2Test(ctx.task.name);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      gvar work:array
        text 'var <workgroup> '
        decl %work
        text ': '
        ref array
        text '<'
        ref u32
        text ', 128>;'"
  `);
});

test("fn f() { _ = 1; }", ctx => {
  const ast = parse2Test(ctx.task.name);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      fn f()
        text 'fn '
        decl %f
        text '() { _ = 1; }'"
  `);
});

test("var foo: vec2<f32 >= vec2( 0.5, -0.5);", ctx => {
  const ast = parse2Test(ctx.task.name);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      gvar foo:vec2
        text 'var '
        decl %foo
        text ': '
        ref vec2
        text '<'
        ref f32
        text ' >= '
        ref vec2
        text '( 0.5, -0.5);'"
  `);
});

test("import ./a/b/c", ctx => {
  const ast = parse2Test(ctx.task.name);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      import package/a/b/c
        text 'import ./a/b/c'"
  `);
});

test("import ./file1/{foo, bar}", ctx => {
  const src = ctx.task.name;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      import package/file1/{foo, bar}
        text 'import ./file1/{foo, bar}'"
  `);
});

test("import ./file1/{foo, bar}", ctx => {
  const src = ctx.task.name;
  const ast = parse2Test(src);
  const imps = ast.imports.map(t => importToString(t)).join("\n");

  expect(imps).toMatchInlineSnapshot(`"package/file1/{foo, bar}"`);
});

test("import foo_bar/boo;", ctx => {
  const ast = parse2Test(ctx.task.name);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      import foo_bar/boo
        text 'import foo_bar/boo;'"
  `);
});

test(`import a/{ b }`, ctx => {
  const ast = parse2Test(ctx.task.name);
  const astString = astTree(ast.moduleElem);
  expect(astString).toMatchInlineSnapshot(`
    "module
      import a/{b}
        text 'import a/{ b }'"
  `);
});

test(`import a/{ b, c/{d, e}, f }`, ctx => {
  const src = ctx.task.name;
  const ast = parse2Test(src);
  const astString = astTree(ast.moduleElem);

  expect(astString).toMatchInlineSnapshot(`
    "module
      import a/{b, (c/{d, e}), f}
        text 'import a/{ b, c/{d, e}, f }'"
  `);
});
