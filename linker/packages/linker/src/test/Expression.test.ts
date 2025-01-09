import { eof, seq } from "mini-parse";
import { expect, test } from "vitest";
import { expression } from "../WESLGrammar.ts";
import { testAppParse } from "./TestUtil.ts";

test("parse number", () => {
  const src = `3`;
  const { parsed } = testAppParse(seq(expression, eof), src);
  expect(parsed).not.toBeNull();
});

test("parse comparisons with && ||", () => {
  const src = `a<3   &&   4>(5)`;
  const { parsed } = testAppParse(seq(expression, eof), src);
  expect(parsed).not.toBeNull();
});

test("parse vec templated type", () => {
  const src = `vec2<f32>`;
  const { parsed } = testAppParse(seq(expression, eof), src);
  expect(parsed).not.toBeNull();
});
