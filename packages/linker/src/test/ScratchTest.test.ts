import { test } from "vitest";
import { testParseWgsl } from "./TestUtil.ts";

// temporary test for isolating a current issue while debugging 
test.skip("example", () => {
  const src = `
    fn f() { _ = 1; }
  `;

  testParseWgsl(src);
});
