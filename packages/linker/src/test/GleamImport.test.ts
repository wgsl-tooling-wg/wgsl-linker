import { testParse, TestParseResult } from "mini-parse/test-util";
import { expect, TaskContext, test } from "vitest";
import { gleamImport } from "../GleamImport.js";

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
test("import foo/bar/{a, b}", expectParses);
test("import a/{b, c }", expectParses);
test("import foo/* as b", expectParses);
test("import foo/a as b", expectParses);
test(`import a/b/{c as foo}`, expectParses);

test(
  `
  import ./foo/bar
  fn main() {}
  `,
  expectParses
);

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

/**  ----- extraction tests -----  */
test("import foo/bar", (ctx) => {
  const { appState } = expectParses(ctx);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 14,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "args": undefined,
              "as": undefined,
              "name": "foo",
            },
            SimpleSegment {
              "args": undefined,
              "as": undefined,
              "name": "bar",
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `);
});

test("import foo/* as b", (ctx) => {
  const { appState } = expectParses(ctx);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 17,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "args": undefined,
              "as": undefined,
              "name": "foo",
            },
            Wildcard {
              "as": "b",
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `);
});

test(`import a/{ b, c/{d, e}, f/* }`, (ctx) => {
  const { appState } = expectParses(ctx);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 29,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "args": undefined,
              "as": undefined,
              "name": "a",
            },
            SegmentList {
              "list": [
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "args": undefined,
                      "as": undefined,
                      "name": "b",
                    },
                  ],
                },
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "args": undefined,
                      "as": undefined,
                      "name": "c",
                    },
                    SegmentList {
                      "list": [
                        ImportTree {
                          "segments": [
                            SimpleSegment {
                              "args": undefined,
                              "as": undefined,
                              "name": "d",
                            },
                          ],
                        },
                        ImportTree {
                          "segments": [
                            SimpleSegment {
                              "args": undefined,
                              "as": undefined,
                              "name": "e",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "args": undefined,
                      "as": undefined,
                      "name": "f",
                    },
                    Wildcard {
                      "as": undefined,
                    },
                  ],
                },
              ],
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `);
});

test("import ./foo/bar", (ctx) => {
  const { appState } = expectParses(ctx);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 16,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "args": undefined,
              "as": undefined,
              "name": ".",
            },
            SimpleSegment {
              "args": undefined,
              "as": undefined,
              "name": "foo",
            },
            SimpleSegment {
              "args": undefined,
              "as": undefined,
              "name": ".",
            },
            SimpleSegment {
              "args": undefined,
              "as": undefined,
              "name": "foo",
            },
            SimpleSegment {
              "args": undefined,
              "as": undefined,
              "name": "bar",
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `);
});
