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

test("parse comparisons with && ||", () => {
  const src = `a<3   &&   4>(5)`;
  const { parsed } = testAppParse(seq(expression, eof), src);
  expect(parsed).not.toBeNull();
  expect(parsed!.tags.identLoc).toEqual([
    [
      {
        name: "a",
        start: 0,
        end: 1,
      },
    ],
  ]);
});

test("parse vec templated type", () => {
  const src = `vec2<f32>`;

  const { parsed } = testAppParse(seq(expression, eof), src);
  expect(parsed?.tags.identLoc).toEqual([
    [
      {
        name: "vec2",
        start: 0,
        end: 4,
      },
    ],
    [
      {
        name: "f32",
        start: 5,
        end: 8,
      },
    ],
  ]);

  expect((parsed?.tags.template as any).length).toBe(1);
});
