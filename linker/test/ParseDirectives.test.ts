import { _withBaseLogger, tokens } from "@wesl/mini-parse";
import { logCatch } from "@wesl/mini-parse/test-util";

import { expect, test } from "vitest";
import { assertSnapshot } from "@std/testing/snapshot";
import { ModuleElem, TreeImportElem } from "../AbstractElems.ts";
import { SimpleSegment, treeToString } from "../ImportTree.ts";
import { argsTokens } from "../MatchWgslD.ts";
import { directive, importing } from "../ParseDirective.ts";
import { parseWgslD } from "../ParseWgslD.ts";
import { last } from "../Util.ts";
import { testAppParse } from "./TestUtil.ts";

test("directive parses #export", () => {
  const { appState } = testAppParse(directive, "#export");
  expect(appState[0].kind).toBe("export");
});

test("parse #export", () => {
  const parsed = parseWgslD("#export");
  expect(parsed[0].kind).toBe("export");
});

test("parse import foo/bar", async (ctx) => {
  const parsed = parseWgslD("import foo/bar");
  await assertSnapshot(ctx, parsed);
});

test("parse #import foo(a,b) as baz from bar", async (ctx) => {
  const parsed = parseWgslD("#import foo as baz from bar");
  await assertSnapshot(ctx, parsed);
});

test("parse #export(foo) with trailing space", async (ctx) => {
  const src = `
    export (Elem) 
  `;

  const parsed = parseWgslD(src);
  await assertSnapshot(ctx, parsed);
});

test.ignore("importing parses importing bar(A) fog(B)", async (ctx) => {
  const src = ` importing bar(A), fog(B)`;
  const { parsed } = testAppParse(tokens(argsTokens, importing), src);
  await assertSnapshot(ctx, parsed?.tags.importing);
});

test.ignore("parse #export(A, B) importing bar(A)", async (ctx) => {
  const src = `
    #export(A, B) importing bar(A)
    fn foo(a:A, b:B) { bar(a); }
  `;
  const parsed = parseWgslD(src);
  await assertSnapshot(ctx, parsed[0]);
});

test("#export w/o closing paren", async (ctx) => {
  const src = `#export (A
    )
    `;
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => parseWgslD(src));
  await assertSnapshot(ctx, logged());
});

test.ignore("parse #extends", async (ctx) => {
  const src = `#extends Foo(a,b) as Bar from baz`;
  const appState = parseWgslD(src);
  await assertSnapshot(ctx, appState[0]);
});

test("parse extends", async (ctx) => {
  const src = `extends Foo(a,b) as Bar from baz`;
  const appState = parseWgslD(src);
  await assertSnapshot(ctx, appState[0]);
});

test("parse module foo.bar.ca", () => {
  const src = `module foo.bar.ca`;
  const appState = parseWgslD(src);
  expect(appState[0].kind).toBe("module");
  expect((appState[0] as ModuleElem).name).toBe("foo.bar.ca");
});

test("module foo.bar.ca", (ctx) => {
  const appState = parseWgslD(ctx.name);
  expect(appState[0].kind).toBe("module");
  expect((appState[0] as ModuleElem).name).toBe("foo.bar.ca");
});

test("module foo::bar::ba", (ctx) => {
  const appState = parseWgslD(ctx.name);
  expect(appState[0].kind).toBe("module");
  expect((appState[0] as ModuleElem).name).toBe("foo/bar/ba");
});

test("module foo/bar/ba", (ctx) => {
  const appState = parseWgslD(ctx.name);
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

test("#import foo from ./util", (ctx) => {
  const appState = parseWgslD(ctx.name);
  const importElem = appState[0] as TreeImportElem;
  const segments = treeToString(importElem.imports);
  expect(segments).toBe("./util/foo");
});

test('import { foo } from "./bar"', (ctx) => {
  const appState = parseWgslD(ctx.name);
  const importElem = appState[0] as TreeImportElem;
  const segments = treeToString(importElem.imports);
  expect(segments).toBe("./bar/foo");
});

test('import { foo, bar } from "./bar"', (ctx) => {
  const appState = parseWgslD(ctx.name);
  const imports = appState.filter((e) => e.kind === "treeImport");
  const segments = imports.map((i) => treeToString(i.imports));
  expect(segments).toContain("./bar/foo");
  expect(segments).toContain("./bar/bar");
});
