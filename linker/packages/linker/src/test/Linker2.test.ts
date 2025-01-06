import { expect, test } from "vitest";
import { link2Test } from "./TestUtil.js";
import { matchTrimmed } from "./shared/StringUtil.js";

test("link global var", () => {
  const src = `var x: i32 = 1;`;
  const result = link2Test(src);
  matchTrimmed(result, src);
});

test("link an alias", () => {
  const src = `
    alias Num = f32;

    fn main() { Num(1.0); }
  `;
  const result = link2Test(src);
  matchTrimmed(result, src);
});

test("link a const_assert", () => {
  const src = `
    var x = 1;
    var y = 2;
    const_assert x < y;
  `;
  const result = link2Test(src);
  matchTrimmed(result, src);
});

test("link a struct", () => {
  const src = `
    struct Point {
      x: i32,
      y: i32,
    }
  `;
  const result = link2Test(src);
  matchTrimmed(result, src);
});

test("link a fn", () => {
  const src = `
    fn foo(x: i32, y: u32) -> f32 { 
      return 1.0; 
    }`;
  const result = link2Test(src);
  matchTrimmed(result, src);
});

test("handle a ptr type", () => {
  const src = `
    fn uint_bitfieldExtract_u1_i1_i1_(
      value: ptr<function, u32>, 
      bits: ptr<function, i32>) -> u32 { }
  `;
  const result = link2Test(src);
  matchTrimmed(result, src);
});

test("struct after var", () => {
  const src = `
    var config: TwoPassConfig;

    struct TwoPassConfig {
      x: u32,
    }
  `;
  const result = link2Test(src);
  matchTrimmed(result, src);
});
