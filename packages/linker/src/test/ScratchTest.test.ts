import { expectNoLog } from "mini-parse/test-util";
import { test } from "vitest";
import { testParseWgsl } from "./TestUtil.ts";

// temporary test for debugging whatver current issue
test.skip("example", () => {
  const src = `
    fn pcg_3u_3u(seed: vec3u) -> vec3u {
      var v = 1;
      v ^= 1;
      return v;
  }
  `;

  expectNoLog(() => {
    testParseWgsl(src);
  });
});
