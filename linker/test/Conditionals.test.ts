import { srcLog, _withBaseLogger } from "@wesl/mini-parse";
import { expectNoLogErr, logCatch } from "@wesl/mini-parse/test-util";
import { expect, test } from "vitest";
import { assertSnapshot } from "@std/testing/snapshot";
import { processConditionals } from "../Conditionals.ts";

test("parse #if #endif", async (ctx) => {
  const src = `
    #if foo
    fn f() { }
    #endif
    `;

  const sourceMap = processConditionals(src, { foo: true });
  expect(sourceMap.dest).toContain("fn f() { }");
  await assertSnapshot(ctx, sourceMap.entries);
});

test("parse // #if !foo", () => {
  const src = `
    // #if !foo
      fn f() { }
    // #endif 
    `;
  const { dest } = processConditionals(src, { foo: false });
  expect(dest).toContain("fn f() { }");
});

test("parse #if !foo (true)", () => {
  const src = `
    // #if !foo
      fn f() { }
    // #endif 
    `;
  expectNoLogErr(() => {
    const { dest } = processConditionals(src, { foo: true });
    expect(dest).not.toContain("fn");
    expect(dest).not.toContain("//");
  });
});

test("parse #if !foo #else #endif", () => {
  const src = `
    // #if !foo
      fn f() { notfoo(); }
    // #else
      fn g() { foo(); }
    // #endif 
    `;
  const { dest } = processConditionals(src, { foo: true });
  expect(dest).toContain("fn g()");
  expect(dest).not.toContain("fn f()");
});

test("parse nested #if", () => {
  const src = `
    #if foo

    #if bar
      fn f() { }
    #endif

    #if zap
      fn zap() { }
    #endif

      fn g() { }
    #endif 
    `;
  const { dest } = processConditionals(src, { foo: true, zap: true });
  expect(dest).toContain("fn zap()");
  expect(dest).toContain("fn g()");
  expect(dest).not.toContain("fn f()");
});

test("parse #if #endif with extra space", () => {
  const src = `
    #if foo 
    fn f() { }
    #endif
    `;

  const { dest } = processConditionals(src, {});
  expect(dest).not.toContain("fn f() { }");
});

test("parse last line", () => {
  const src = `
    #x
    y`;
  const { dest } = processConditionals(src, {});
  expect(dest).toBe(src);
});

test("srcLog with srcMap", async (ctx) => {
  const src = `
  #if !foo
  1234
  #endif`;
  const sourceMap = processConditionals(src, {});

  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    srcLog(sourceMap, [3, 6], "found:");
  });

  await assertSnapshot(ctx, logged());
});

test("unterminated #if", async (ctx) => {
  const src = `
  #if foo
    // bar
  `;
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    processConditionals(src, {});
  });
  await assertSnapshot(ctx, logged());
});

test("unterminated #else", async (ctx) => {
  const src = `
  #if foo
  #else
    // bar
  `;
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    processConditionals(src, {});
  });
  await assertSnapshot(ctx, logged());
});
