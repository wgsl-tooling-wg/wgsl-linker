import { or, parserToString, seq } from "mini-parse";
import { expect, test } from "vitest";
// import { weslRoot } from "../WESLGrammar.ts";

test("print grammar", () => {
  const p: any = or("a", "b", () => p);
  const s = seq("a", "b", () => p);
  const result = parserToString(s);
  expect(result).toMatchInlineSnapshot(`
    "collect
      'a'
      'b'
      fn()
        or
          'a'
          'b'
          fn()
            ->or
    "
  `);
});
