import { expect, test } from "vitest";
import { AstBuilder } from "../AstBuilder.ts";
import { SrcModule } from "../Scope.ts";
import { scopeIdentTree } from "../ScopeLogging.ts";

test("build scope with ident", () => {
  const srcModule: SrcModule = {
    modulePath: "test.wesl",
    src: "let x = 1;",
  };
  let pos = 4;
  const ast = new AstBuilder(srcModule, { position: () => pos });
  ast.addIdent("decl", 4, 5);
  const { rootScope } = ast.build();
  expect(scopeIdentTree(rootScope)).toMatchInlineSnapshot(`"{ %x }"`);
});

test("build scope with child scope", () => {
  const srcModule: SrcModule = {
    modulePath: "test.wesl",
    //    012345678901234567890123456789012345678901234567890123456789012345678901234567890
    src: "fn foo() { x++; }",
  };
  let pos = 3;
  const ast = new AstBuilder(srcModule, { position: () => pos });
  ast.addIdent("decl", 3, 6);
  pos = 9;
  ast.startScope();
  pos = 11;
  ast.addIdent("ref", 11, 12);
  ast.endScope();

  const { rootScope } = ast.build();
  expect(scopeIdentTree(rootScope)).toMatchInlineSnapshot(`
    "{ %foo
      { x }
    }"
  `);
});

test("backtrack ident add", () => {
  const srcModule: SrcModule = {
    modulePath: "test.wesl",
    //    012345678901234567890123456789012345678901234567890123456789012345678901234567890
    src: "fn foo() { x++; }",
  };
  let pos = 3;
  const ast = new AstBuilder(srcModule, { position: () => pos });
  ast.addIdent("decl", 3, 6);
  pos = 9;
  ast.startScope();
  pos = 11;

  ast.addIdent("decl", 11, 14); // wrong
  ast.backtrack(10); // backtrack

  ast.addIdent("ref", 11, 12);

  ast.endScope();

  const { rootScope } = ast.build();
  expect(scopeIdentTree(rootScope)).toMatchInlineSnapshot(`
    "{ %foo
      { x }
    }"
  `);
});
