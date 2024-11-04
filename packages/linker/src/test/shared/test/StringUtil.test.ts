import { expect, test } from "vitest";
import { trimSrc } from "../StringUtil.js";

test("trimSrc on blank", () => {
  const trimmed = trimSrc(``);
  expect(trimmed).toBe("");
});

test("trimSrc with leading blank lines", () => {
  const trimmed = trimSrc(`

    fn foo() {
      // bar
    }`);
  expect(trimmed).toBe("fn foo() {\n  // bar\n}");
});

test("trimSrc with blank line in the middle and at end", () => {
  const trimmed = trimSrc(
    `
      foo

      bar
     `
  );
  expect(trimmed).toBe("foo\n\nbar");
});

test("trimSrc with trailing spaces", () => {
  const trimmed = trimSrc(` foo `);
  expect(trimmed).toBe("foo");
});
