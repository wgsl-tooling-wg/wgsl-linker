import { expect, test } from "vitest";
import { link2Test } from "./TestUtil.js";

test("link global var", () => {
  const src = `var x: i32 = 1;`;
  const result = link2Test(src);
  expect(result).toEqual(src);
});
