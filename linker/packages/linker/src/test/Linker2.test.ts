import { expect, test } from "vitest";
import { link2Test } from "./TestUtil.js";

test("link global var", () => {
  const src = `var x: i32 = 1;`;
  const result = link2Test(src);
  console.log("result:\n\n", result);

  expect(result).toEqual(src);
});
