import { expect, test } from "vitest";
import { mergeTags } from "../ParserUtil.ts";

test("mergeNamed with symbols", () => {
  const s = Symbol("s");
  const a = { [s]: [1, 2, 3] };
  const b = { [s]: [3, 4] };
  const merged = mergeTags(a, b);
  expect(merged[s as any]).toEqual([1, 2, 3, 3, 4]);
});
