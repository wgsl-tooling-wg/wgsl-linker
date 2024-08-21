import { gleamImport } from "../GleamImport.js"
import { expect, test } from "vitest";
import { testParse } from "mini-parse/test-util";
import { dlog } from "berry-pretty";

/* ------  failure cases  -------   */

test("import", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.null;
});

test("import foo", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.null;
});

test("import ./foo", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.null;
});

test("import ./foo /bar", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.null;
});

test("import .", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.null;
});

test("import ./", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.null;
});

test("import foo/{*, *}", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.null;
});

test("import foo/{ }", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.null;
});


/* ------  success cases  -------   */

test.only("import ./foo/bar", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.not.null;
  dlog(result.appState)
});

test("import ./foo/bar;", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.position).eq(ctx.task.name.length);  // consume semicolon (so that linking will remove it) 
  expect(result.parsed).is.not.null;
});

test("import ../../foo/bar", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.not.null;
});

test("import foo/bar", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.not.null;
});

test("import foo/{a,b}", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.not.null;
});

test("import foo/{a, b}", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.not.null;
});

test("import foo/{a, b}", (ctx) => {
  const result = testParse(gleamImport, ctx.task.name);
  expect(result.parsed).is.not.null;
});
