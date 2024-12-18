import { expect, test } from "vitest";
import { ModuleElem, TreeImportElem } from "../AbstractElems.js";
import { treeToString } from "../ImportTree.js";
import { directive } from "../ParseDirective.js";
import { parseWESL } from "../ParseWESL.js";
import { testAppParse } from "./TestUtil.js";

test("directive parses #export", () => {
  const { stable } = testAppParse(directive, "#export");
  expect(stable.elems[0].kind).toBe("export");
});

test("parse #export", () => {
  const parsed = parseWESL("#export").elems;
  expect(parsed[0].kind).toBe("export");
});

test("parse import foo/bar", () => {
  const parsed = parseWESL("import foo/bar").elems;
  expect(parsed).toMatchSnapshot();
});

test("parse module foo.bar.ca", () => {
  const src = `module foo.bar.ca`;
  const appState = parseWESL(src).elems;
  expect(appState[0].kind).toBe("module");
  expect((appState[0] as ModuleElem).name).toBe("foo.bar.ca");
});

test("module foo.bar.ca", ctx => {
  const appState = parseWESL(ctx.task.name).elems;
  expect(appState[0].kind).toBe("module");
  expect((appState[0] as ModuleElem).name).toBe("foo.bar.ca");
});

test("module foo::bar::ba", ctx => {
  const appState = parseWESL(ctx.task.name).elems;
  expect(appState[0].kind).toBe("module");
  expect((appState[0] as ModuleElem).name).toBe("foo/bar/ba");
});

test("module foo/bar/ba", ctx => {
  const appState = parseWESL(ctx.task.name).elems;
  expect(appState[0].kind).toBe("module");
  expect((appState[0] as ModuleElem).name).toBe("foo/bar/ba");
});

test("import ./util/foo;", ctx => {
  const appState = parseWESL(ctx.task.name).elems;
  const importElem = appState[0] as TreeImportElem;
  const segments = treeToString(importElem.imports);
  expect(segments).toBe("./util/foo");
});

test("import ./bar/foo;", ctx => {
  const appState = parseWESL(ctx.task.name).elems;
  const importElem = appState[0] as TreeImportElem;
  const segments = treeToString(importElem.imports);
  expect(segments).toBe("./bar/foo");
});

test("import ./bar/{foo,bar};", ctx => {
  const appState = parseWESL(ctx.task.name).elems;
  const imports = appState.filter(e => e.kind === "treeImport");
  const segments = imports.map(i => treeToString(i.imports));
  expect(segments).toContain("./bar/{(foo), (bar)}");
});
