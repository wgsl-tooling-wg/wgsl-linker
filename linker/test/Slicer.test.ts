import { SrcMap } from "@wesl/mini-parse";
import { expect, test } from "vitest";
import { assertSnapshot } from "@std/testing/snapshot";
import { sliceReplace } from "../Slicer.ts";

test("slice middle", async (ctx) => {
  const src = "aaabbbc";
  const srcMap = sliceReplace(src, [{ start: 3, end: 6, replacement: "X" }]);
  const { dest, entries } = srcMap;
  expect(dest).toBe("aaaXc");
  await assertSnapshot(ctx, entries);
});

test("slice end", () => {
  const src = "aaabbb";
  const srcMap = sliceReplace(src, [{ start: 3, end: 6, replacement: "X" }]);
  expect(srcMap.dest).toBe("aaaX");
  validateDestCovered(srcMap);
});

test("slice beginning", () => {
  const src = "aaabbb";
  const srcMap = sliceReplace(src, [{ start: 0, end: 3, replacement: "X" }]);
  validateDestCovered(srcMap);
  expect(srcMap.dest).toBe("Xbbb");
});

test("slice multiple", () => {
  const src = "aaabbbc";
  const srcMap = sliceReplace(src, [
    { start: 3, end: 6, replacement: "B" },
    { start: 0, end: 3, replacement: "A" },
  ]);
  validateDestCovered(srcMap);
  expect(srcMap.dest).toBe("ABc");
  expect(srcMap.entries.length).toBe(3);
});

test("slice none", () => {
  const src = "aaabbbc";
  const srcMap = sliceReplace(src, []);
  validateDestCovered(srcMap);
  expect(srcMap.dest).toBe(src);
});

test("slice none with start and end", () => {
  const src = "aaabbbc";
  const srcMap = sliceReplace(src, [], 3, 6);
  validateDestCovered(srcMap);
  expect(srcMap.dest).toBe("bbb");
});

test("slice one with start and end", () => {
  const src = "aaabbbc";

  const slices = [{ start: 3, end: 6, replacement: "B" }];
  const srcMap = sliceReplace(src, slices, 2);
  validateDestCovered(srcMap);
  expect(srcMap.dest).toBe("aBc");
});

test("slice with empty replacement", () => {
  const src = "aaabbbc";

  const slices = [{ start: 3, end: 6, replacement: "" }];
  const srcMap = sliceReplace(src, slices);
  validateDestCovered(srcMap);
  expect(srcMap.dest).toBe("aaac");
});

/** verify that the srcMap covers every part of the destination text */
function validateDestCovered(srcMap: SrcMap): void {
  const { dest, entries } = srcMap;
  let destPos = 0;
  entries.forEach(e => {
    expect(e.destStart).toBe(destPos);
    destPos = e.destEnd;
  });
  expect(destPos).toBe(dest.length);
}
