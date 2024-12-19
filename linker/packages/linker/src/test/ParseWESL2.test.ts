import { expect, test } from "vitest";
import { astTree } from "../ASTLogging.ts";
import { parse2Test } from "./TestUtil.ts";

test("parse global var", () => {
  const src = `var x: i32 = 1;`;
  const ast = parse2Test(src);
  const astString = astTree(ast.rootModule);
  expect(astString).toMatchInlineSnapshot(`
    "module
      var x:i32
        text 'var '
        ident %x
        text ': '
        ident i32
        text ' = 1'
      text ';'"
  `);
});

test("parse alias", () => {
  const src = `alias Num = i32;`;
  const ast = parse2Test(src);
  const astString = astTree(ast.rootModule);
  expect(astString).toMatchInlineSnapshot(`
    "module
      alias %Num=i32
        text 'alias '
        ident %Num
        text ' = '
        ident i32
        text ';'"
  `);
});

test("parse const", () => {
  const src = `const y = 11u;`;
  const ast = parse2Test(src);
  const astString = astTree(ast.rootModule);
  expect(astString).toMatchInlineSnapshot(`
    "module
      const y
        text 'const '
        ident %y
        text ' = 11u'
      text ';'"
  `);
});

test("parse override ", () => {
  const src = `override z: f32;`;
  const ast = parse2Test(src);
  const astString = astTree(ast.rootModule);
  expect(astString).toMatchInlineSnapshot(`
    "module
      override z:f32
        text 'override '
        ident %z
        text ': '
        ident f32
      text ';'"
  `);
});

test("parse const_assert", () => {
  const src = `const_assert x < y;`;
  const ast = parse2Test(src);
  const astString = astTree(ast.rootModule);
  expect(astString).toMatchInlineSnapshot(`
    "module
      assert
        text 'const_assert '
        ident x
        text ' < '
        ident y
        text ';'"
  `);
});
