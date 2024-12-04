import { expect, test } from "vitest";
import { AstBuilder, buildAstAndScope } from "../AstBuilder.ts";
import { SrcModule } from "../Scope.ts";
import { dlog } from "berry-pretty";

test("build scope with ident", () => {
  const srcModule: SrcModule = {
    modulePath: "test.wesl",
    src: "let x = 1;",
  };
  const ast = new AstBuilder(srcModule);
  ast.addIdent("decl", 4, 5);
  const { rootScope } = ast.build();
  expect({ rootScope }).toMatchSnapshot();
});

test("build scope with child scope", () => {
  const srcModule: SrcModule = {
    modulePath: "test.wesl",
    //    012345678901234567890123456789012345678901234567890123456789012345678901234567890
    src: "fn foo() { x++; }",
  };
  const ast = new AstBuilder(srcModule);
  ast.addIdent("decl", 3, 6);
  ast.startScope();
  ast.addIdent("ref", 11, 12);
  ast.endScope();

  const { rootScope } = ast.build();
  expect({ rootScope }).toMatchSnapshot();
});
