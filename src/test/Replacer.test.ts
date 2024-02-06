import { test, expect } from "vitest";
import { replaceTokens, replacer } from "../Replacer.js";
import { dlog } from "berry-pretty";

test("parse blank line", () => {
  const src = "";
  const result = replacer(src, {});
  expect(result).eq(src);
});

test("parse line w/o replacement", () => {
  const src = "fn main() { // foo";
  const result = replacer(src, {});
  expect(result).eq(src);
});

test("parse line w/ single replacement", () => {
  const src = "var a = 4; // #replace 4=workSize";
  const result = replacer(src, { workSize: 128 });
  expect(result).includes("var a = 128;");
});

test("parse line w/ mulitple replacement", () => {
  const src = "for (var a = 0; a <= 4; a++) { // #replace 0=start 4=end";
  const result = replacer(src, { start: 128, end: 255 });
  expect(result).includes("a = 128; a <= 255;");
});

test("parse line w/ quoted replace", () => {
  const src = 'const b; // #replace "const b"=decl';
  const result = replacer(src, { decl: "var a" });
  expect(result).includes("var a;");
});