import { dlog } from "berry-pretty";
import { test } from "vitest";
import { internalParseWesl } from "../ParseWESL.ts";

test.skip("scope from simple fn", () => {
  const src = `
    fn main() {
      var x: i32 = 1;
    }
  `;
  const result = internalParseWesl(src);
  dlog({ scope: result.context.scope });
});
