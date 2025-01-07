import { expect, test } from "vitest";
import { importSyntaxCases } from "wesl-testsuite";
import { gleamImport } from "../GleamImport.js";
import { testAppParse } from "./TestUtil.js";

function expectParseFail(src: string): void {
  const result = testAppParse(gleamImport, src);
  expect(result.stable.imports).toEqual([]);
}

function expectParses(src: string): void {
  const result = testAppParse(gleamImport, src);
  expect(result.stable.imports.length).toBeGreaterThan(0);
}

importSyntaxCases.forEach(c => {
  if (c.fails) {
    test(c.src, () => expectParseFail(c.src));
  } else {
    test(c.src, () => expectParses(c.src));
  }
});
