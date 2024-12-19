import { expect, test } from "vitest";
import { link2Test } from "./TestUtil.js";

test("link global var", () => {
  const src = `var x: i32 = 1;`;
  const result = link2Test(src);
  expect(result).toEqual(src);
});

test("link an alias", () => {
  const src = `
    alias Num = f32;

    fn main() { Num(1.0); }
  `;
  const result = link2Test(src);
  expect(result).toEqual(src);
});

test("link an const_assert", () => {
  const src = `
    var x = 1;
    var y = 2;
    const_assert x < y;
  `;
  const result = link2Test(src);
  expect(result).toEqual(src);
});