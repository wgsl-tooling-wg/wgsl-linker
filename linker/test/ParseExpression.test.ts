import { expect, test } from "vitest";
import { testAppParse } from "./TestUtil";
import { expression } from "../ParseWgslD";
import { eof, seq } from "mini-parse";
test("parse number", () => {
  const src = `3`;

  const { parsed } = testAppParse(seq(expression, eof), src);
  expect(parsed).not.toBeNull();
});

test("parse comparisons with && ||", () => {
  const src = `array<3 && 4>(5)`;

  const { parsed } = testAppParse(seq(expression, eof), src);
  expect(parsed).not.toBeNull();
  // TODO: Check that it doesn't have a template generic
});
