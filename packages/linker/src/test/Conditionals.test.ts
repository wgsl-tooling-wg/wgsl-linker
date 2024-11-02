import { _withBaseLogger, srcLog } from "mini-parse";
import { expectNoLogErr, logCatch } from "mini-parse/test-util";
import { expect, test } from "vitest";
import { processConditionals } from "../Conditionals.js";

test("parse #if #endif", () => {
  const src = `
    #if foo
    fn f() { }
    #endif
    `;

  const sourceMap = processConditionals(src, { foo: true });
  expect(sourceMap.dest).contains("fn f() { }");
  expect(sourceMap.entries).toMatchInlineSnapshot(`
    [
      {
        "destEnd": 1,
        "destStart": 0,
        "src": "
        #if foo
        fn f() { }
        #endif
        ",
        "srcEnd": 1,
        "srcStart": 0,
      },
      {
        "destEnd": 16,
        "destStart": 1,
        "src": "
        #if foo
        fn f() { }
        #endif
        ",
        "srcEnd": 28,
        "srcStart": 13,
      },
      {
        "destEnd": 20,
        "destStart": 16,
        "src": "
        #if foo
        fn f() { }
        #endif
        ",
        "srcEnd": 43,
        "srcStart": 39,
      },
    ]
  `);
});

test("parse // #if !foo", () => {
  const src = `
    // #if !foo
      fn f() { }
    // #endif 
    `;
  const { dest } = processConditionals(src, { foo: false });
  expect(dest).contains("fn f() { }");
});

test("parse #if !foo (true)", () => {
  const src = `
    // #if !foo
      fn f() { }
    // #endif 
    `;
  expectNoLogErr(() => {
    const { dest } = processConditionals(src, { foo: true });
    expect(dest).not.contains("fn");
    expect(dest).not.contains("//");
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
  expect(dest).contains("fn g()");
  expect(dest).not.contains("fn f()");
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
  expect(dest).contains("fn zap()");
  expect(dest).contains("fn g()");
  expect(dest).not.contains("fn f()");
});

test("parse #if #endif with extra space", () => {
  const src = `
    #if foo 
    fn f() { }
    #endif
    `;

  const { dest } = processConditionals(src, {});
  expect(dest).not.contains("fn f() { }");
});

test("parse last line", () => {
  const src = `
    #x
    y`;
  const { dest } = processConditionals(src, {});
  expect(dest).eq(src);
});

test("srcLog with srcMap", () => {
  const src = `
  #if !foo
  1234
  #endif`;
  const sourceMap = processConditionals(src, {});

  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    srcLog(sourceMap, [3, 6], "found:");
  });

  expect(logged()).toMatchInlineSnapshot(`
    "found:
      1234   Ln 3
      ^  ^"
  `);
});

test("unterminated #if", () => {
  const src = `
  #if foo
    // bar
  `;
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    processConditionals(src, {});
  });
  expect(logged()).toMatchInlineSnapshot(`
    "unmatched #if/#else
      #if foo   Ln 2
      ^"
  `);
});

test("unterminated #else", () => {
  const src = `
  #if foo
  #else
    // bar
  `;
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    processConditionals(src, {});
  });
  expect(logged()).toMatchInlineSnapshot(`
    "unmatched #if/#else
      #else   Ln 3
      ^"
  `);
});
