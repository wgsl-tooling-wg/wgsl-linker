import { testParse, TestParseResult } from "@wesl/mini-parse/test-util";
import { expect, test } from "vitest";
import { assertSnapshot } from "@std/testing/snapshot";
import { gleamImport } from "../GleamImport.ts";

function expectParses(ctx: Deno.TestContext): TestParseResult<void> {
  const result = testParse(gleamImport, ctx.name);
  expect(result.parsed).not.toBeNull();
  return result;
}
/* ------  success cases  -------   */

test("import ./foo/bar;", (ctx) => {
  const result = expectParses(ctx);
  expect(result.position).toBe(ctx.name.length); // consume semicolon (so that linking will remove it)
});

test("import foo-bar/boo", (ctx) => {
  expectParses(ctx);
});

/**  ----- extraction tests -----  */
test("import foo/bar", async (ctx) => {
  const { appState } = expectParses(ctx);
  await assertSnapshot(ctx, appState);
});

test("import foo/* as b", async (ctx) => {
  const { appState } = expectParses(ctx);
  await assertSnapshot(ctx, appState);
});

test(`import a/{ b, c/{d, e}, f/* }`, async (ctx) => {
  const { appState } = expectParses(ctx);
  await assertSnapshot(ctx, appState);
});

test("import ./foo/bar", async (ctx) => {
  const { appState } = expectParses(ctx);
  await assertSnapshot(ctx, appState);
});
