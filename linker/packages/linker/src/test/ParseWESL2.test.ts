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
