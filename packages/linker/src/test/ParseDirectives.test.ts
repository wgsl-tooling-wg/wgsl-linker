import { tokens, _withBaseLogger } from "mini-parse";
import { logCatch } from "mini-parse/test-util";

import { expect, test } from "vitest";
import { ModuleElem, TreeImportElem } from "../AbstractElems.js";
import { SimpleSegment, treeToString } from "../ImportTree.js";
import { argsTokens } from "../MatchWgslD.js";
import { directive, importing } from "../ParseDirective.js";
import { parseWgslD } from "../ParseWgslD.js";
import { last } from "../Util.js";
import { testAppParse } from "./TestUtil.js";

test("directive parses #export", () => {
  const { appState } = testAppParse(directive, "#export");
  expect(appState[0].kind).toBe("export");
});

test("parse #export", () => {
  const parsed = parseWgslD("#export");
  expect(parsed[0].kind).toBe("export");
});

test("parse import foo/bar", () => {
  const parsed = parseWgslD("import foo/bar");
  expect(parsed).toMatchSnapshot();
});

test("parse #import foo(a,b) as baz from bar", () => {
  const parsed = parseWgslD("#import foo as baz from bar");
  expect(parsed).toMatchSnapshot();
});

test("parse #export(foo) with trailing space", () => {
  const src = `
    export (Elem) 
  `;

  const parsed = parseWgslD(src);
  expect(parsed).toMatchSnapshot();
});

test.skip("importing parses importing bar(A) fog(B)", () => {
  const src = ` importing bar(A), fog(B)`;
  const { parsed } = testAppParse(tokens(argsTokens, importing), src);
  expect(parsed?.tags.importing).toMatchSnapshot();
});

test.skip("parse #export(A, B) importing bar(A)", () => {
  const src = `
    #export(A, B) importing bar(A)
    fn foo(a:A, b:B) { bar(a); }
  `;
  const parsed = parseWgslD(src);
  expect(parsed[0]).toMatchSnapshot();
});

test("#export w/o closing paren", () => {
  const src = `#export (A
    )
    `;
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => parseWgslD(src));
  expect(logged()).toMatchInlineSnapshot(`
    "expected text ')''
    #export (A   Ln 1
              ^"
  `);
});

test.skip("parse #extends", () => {
  const src = `#extends Foo(a,b) as Bar from baz`;
  const appState = parseWgslD(src);
  expect(appState[0]).toMatchInlineSnapshot(`
    {
      "args": [
        "a",
        "b",
      ],
      "as": "Bar",
      "end": 33,
      "from": "baz",
      "kind": "extends",
      "name": "Foo",
      "start": 0,
    }
  `);
});

test("parse extends", () => {
  const src = `extends Foo(a,b) as Bar from baz`;
  const appState = parseWgslD(src);
  expect(appState[0]).toMatchInlineSnapshot(`
    {
      "args": [
        "a",
        "b",
      ],
      "as": "Bar",
      "end": 32,
      "from": "baz",
      "kind": "extends",
      "name": "Foo",
      "start": 0,
    }
  `);
});

test("parse module foo.bar.ca", () => {
  const src = `module foo.bar.ca`;
  const appState = parseWgslD(src);
  expect(appState[0].kind).toBe("module");
  expect((appState[0] as ModuleElem).name).toBe("foo.bar.ca");
});

test("module foo.bar.ca", ctx => {
  const appState = parseWgslD(ctx.task.name);
  expect(appState[0].kind).toBe("module");
  expect((appState[0] as ModuleElem).name).toBe("foo.bar.ca");
});

test("module foo::bar::ba", ctx => {
  const appState = parseWgslD(ctx.task.name);
  expect(appState[0].kind).toBe("module");
  expect((appState[0] as ModuleElem).name).toBe("foo/bar/ba");
});

test("module foo/bar/ba", ctx => {
  const appState = parseWgslD(ctx.task.name);
  expect(appState[0].kind).toBe("module");
  expect((appState[0] as ModuleElem).name).toBe("foo/bar/ba");
});

test("parse import with numeric types", () => {
  const nums = "1u 2.0F 0x010 -7.0 1e7".split(" ");
  const src = `#import foo(${nums.join(",")}) from bar`;
  const appState = parseWgslD(src);

  const segments = (appState[0] as TreeImportElem).imports.segments;
  const lastSegment = last(segments) as SimpleSegment;
  expect(lastSegment.args).toEqual(nums);
});

test("#import foo from ./util", ctx => {
  const appState = parseWgslD(ctx.task.name);
  const importElem = appState[0] as TreeImportElem;
  const segments = treeToString(importElem.imports);
  expect(segments).toBe("./util/foo");
});

test('import { foo } from "./bar"', ctx => {
  const appState = parseWgslD(ctx.task.name);
  const importElem = appState[0] as TreeImportElem;
  const segments = treeToString(importElem.imports);
  expect(segments).toBe("./bar/foo");
});

test('import { foo, bar } from "./bar"', ctx => {
  const appState = parseWgslD(ctx.task.name);
  const imports = appState.filter(e => e.kind === "treeImport");
  const segments = imports.map(i => treeToString(i.imports));
  expect(segments).toContain("./bar/foo");
  expect(segments).toContain("./bar/bar");
});
