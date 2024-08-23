import { tokens } from "mini-parse";
import { expect, test } from "vitest";
import { argsTokens } from "../MatchWgslD.js";
import { parseWgslD } from "../ParseWgslD.js";
import { rustImport } from "../RustDirective.js";
import { testAppParse } from "./TestUtil.js";

const testRustImport = tokens(argsTokens, rustImport);

test.skip("import a::b::c", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test.skip("import my::lighting::pbr;", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test.skip("import my::lighting::{ pbr };", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test.skip(`import my::lighting::{ pbr, jelly };`, (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test.skip("import my::lighting::{ pbr, jelly::jam };", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test.skip("import my::lighting::{ pbr as lights }", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test.skip("import a::*", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test.skip("import a::{b, c}::*", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
});

test.skip("multiline import", () => {
  const src = `import a::
        {b, c}::*;`;
  const { appState } = testAppParse(testRustImport, src);
  expect(appState).toMatchSnapshot();
});

test.skip("import a", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchSnapshot();
})

// LATER disable single word imports for ts style imports
test.skip("single word import, root parser", () => {
  const src = `import a`;

  const parsed = parseWgslD(src);
  expect(parsed[0].kind).toBe("treeImport");
});