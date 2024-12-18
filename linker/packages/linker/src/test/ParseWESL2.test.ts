import { expect, test } from "vitest";
import { astTree } from "../ASTLogging.ts";
import { parse2Test } from "./TestUtil.ts";

test("link global var", () => {
  const src = `var x: i32 = 1;`;
  const ast = parse2Test(src);
  const result = astTree(ast.rootModule);
  expect(result).toMatchInlineSnapshot(`
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
