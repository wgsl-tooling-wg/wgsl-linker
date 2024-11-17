import { test } from "vitest";
import { testParseWgsl } from "./TestUtil.ts";

// temporary test for isolating a current issue while debugging 
test.skip("example", () => {
  const src = `
    var <workgroup> work: array<u32, 128>; 
  `;

  testParseWgsl(src);
});
