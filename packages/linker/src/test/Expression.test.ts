import { dlog } from "berry-pretty";
import { eof, seq } from "mini-parse";
import { expect, test } from "vitest";
import { expression } from "../ParseWgslD.ts";
import { testAppParse } from "./TestUtil.ts";

test("parse number", () => {
  const src = `3`;
  const { parsed } = testAppParse(seq(expression, eof), src);
  expect(parsed).not.toBeNull();
  expect(parsed!.tags.ident).toBeUndefined();
});

// TODO fixme
test.skip("parse comparisons with && ||", () => {
  const src = `array<3 && 4>(5)`;
  const { parsed } = testAppParse(seq(expression, eof), src);
  dlog({ parsed });
  expect(parsed).not.toBeNull();
  expect(parsed!.tags.ident).toEqual(["array"]);
});
