import { gleamImport } from "../GleamImport.js";
import { expect, TaskContext, test } from "vitest";
import { testParse, TestParseResult } from "mini-parse/test-util";

function expectParseFail(ctx: TaskContext): void {
  const failPrefix = "bad: ";
  const src = ctx.task.name.slice(failPrefix.length);
  const result = testParse(gleamImport, src);
  expect(result.parsed).is.null;
}

function expectParses(ctx: TaskContext): TestParseResult<void> {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.not.null;
  return result;
}
/* ------  failure cases  -------   */

test("bad: import", expectParseFail);
test("bad: import foo", expectParseFail);
test("bad: import ./foo", expectParseFail);
test("bad: import ../foo", expectParseFail);
test("bad: import ./foo /bar", expectParseFail);
test("bad: import .", expectParseFail);
test("bad: import ./", expectParseFail);
test("bad: import ../", expectParseFail);
test("bad: import ../.", expectParseFail);
test("bad: import ../..", expectParseFail);
test("bad: import foo/{*}", expectParseFail);
test("bad: import foo/*/b", expectParseFail);
test("bad: import foo/{}", expectParseFail);
test("bad: import foo/../bar/baz", expectParseFail);
test("bad: import foo/bee as boo/bar", expectParseFail);

/* ------  success cases  -------   */

test("import ./foo/bar", expectParses);
test("import ../../foo/bar", expectParses);
test(`import ../b/c/d`, expectParses);
test(`import a/b/c`, expectParses);
test("import foo/bar", expectParses);
test("import foo/{a,b}", expectParses);
test("import foo/{a, b}", expectParses);
test("import a/{b, c }", expectParses);
test("import foo/* as b", expectParses);
test("import foo/a as b", expectParses);
test(`import bevy_render/maths/{orthonormalize as onorm}`, expectParses);
test(
  `import bevy_pbr/{
  mesh_view_bindings,
  utils/{PI, noise},
  lighting/*
}`,
  expectParses
);

test("import ./foo/bar;", (ctx) => {
  const result = expectParses(ctx);
  expect(result.position).eq(ctx.task.name.length); // consume semicolon (so that linking will remove it)
});
