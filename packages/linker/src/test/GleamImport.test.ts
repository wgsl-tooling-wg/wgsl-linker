import { gleamImport } from "../GleamImport.js";
import { expect, TaskContext, test } from "vitest";
import { testParse, TestParseResult } from "mini-parse/test-util";
import { dlog } from "berry-pretty";

function expectParseFail(ctx: TaskContext): void {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.null;
}

function expectParses(ctx: TaskContext): TestParseResult<void> {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.not.null;
  return result;
}
/* ------  failure cases  -------   */

test("import", expectParseFail);
test("import foo", expectParseFail);
test("import ./foo", expectParseFail);
test("import ./foo /bar", expectParseFail);
test("import .", expectParseFail);
test("import ./", expectParseFail);
test("import foo/{*}", expectParseFail);
test("import foo/{}", expectParseFail);
test("import foo/../bar/baz", expectParseFail);
test("import foo/bee as boo/bar", expectParseFail);

/* ------  success cases  -------   */

test("import ./foo/bar", expectParses);

test("import ./foo/bar;", (ctx) => {
  const result = expectParses(ctx);
  expect(result.position).eq(ctx.task.name.length); // consume semicolon (so that linking will remove it)
});

test("import ../../foo/bar", expectParses);
test("import foo/bar", expectParses);
test("import foo/{a,b}", expectParses);
test("import foo/{a, b}", expectParses);
test("import foo/{a, b}", expectParses);
test("import foo/* as boo", expectParses);
test("import foo/bee as boo", expectParses);
