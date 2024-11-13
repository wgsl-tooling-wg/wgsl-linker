import { expect, test } from "vitest";
import { ModuleElem, TreeImportElem } from "../AbstractElems.ts";
import { treeToString } from "../ImportTree.ts";
import { directive } from "../ParseDirective.ts";
import { parseWgslD } from "../ParseWgslD.ts";
import { testAppParse } from "./TestUtil.ts";
import { assertSnapshot } from "@std/testing/snapshot";

test.ignore("directive parses #export", () => {
  const { appState } = testAppParse(directive, "#export");
  expect(appState[0].kind).toBe("export");
});

test.ignore("parse #export", () => {
  const parsed = parseWgslD("#export");
  expect(parsed[0].kind).toBe("export");
});

test("parse import foo/bar", async (ctx) => {
  const parsed = parseWgslD("import foo/bar");
  await assertSnapshot(ctx, parsed);
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

test("import ./util/foo;", (ctx) => {
  const appState = parseWgslD(ctx.name);
  const importElem = appState[0] as TreeImportElem;
  const segments = treeToString(importElem.imports);
  expect(segments).toBe("./util/foo");
});

test("import ./bar/foo;", (ctx) => {
  const appState = parseWgslD(ctx.name);
  const importElem = appState[0] as TreeImportElem;
  const segments = treeToString(importElem.imports);
  expect(segments).toBe("./bar/foo");
});

test("import ./bar/{foo,bar};", (ctx) => {
  const appState = parseWgslD(ctx.name);
  const imports = appState.filter((e) => e.kind === "treeImport");
  const segments = imports.map((i) => treeToString(i.imports));
  expect(segments).toContain("./bar/{(foo), (bar)}");
});
