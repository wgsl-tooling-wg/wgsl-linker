import { TestParseResult } from "mini-parse/test-util";
import { expect, test } from "vitest";
import { importSyntaxCases } from "wesl-testsuite";
import { gleamImport } from "../GleamImport.js";
import { testAppParse } from "./TestUtil.js";

function expectParseFail(src: string): void {
  const result = testAppParse(gleamImport, src);
  expect(result.parsed).toBeNull();
}

function expectParses(src: string): TestParseResult<void> {
  const result = testAppParse(gleamImport, src);
  expect(result.parsed).not.toBeNull();
  return result;
}

importSyntaxCases.forEach(c => {
  if (c.fails) {
    test(c.src, () => expectParseFail(c.src));
  } else {
    test(c.src, () => expectParses(c.src));
  }
});
