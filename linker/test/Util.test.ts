import { expect, test } from "vitest";
import { overlapTail, scan } from "../Util.ts";

test("scan", () => {
  const result = scan([1, 2, 1], (a, b: string) => b.slice(a), "foobar");
  expect(result).toEqual(["foobar", "oobar", "bar", "ar"]);
});

test("overlap 0", () => {
  const result = overlapTail([2, 3], [4, 5]);
  expect(result).toBeUndefined();
});

test("overlap 1", () => {
  const result = overlapTail([2, 3], [3, 4, 5]);
  expect(result).toEqual([4, 5]);
});

test("overlap 2", () => {
  const result = overlapTail([2, 3], [2, 3]);
  expect(result).toEqual([]);
});
