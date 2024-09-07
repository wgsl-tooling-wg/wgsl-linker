import { testParse, TestParseResult } from "mini-parse/test-util";
import { expect, test } from "vitest";
import { importSyntaxCases } from "wesl-testsuite"
import { gleamImport } from "../GleamImport.js";

function expectParseFail(src: string): void {
  const result = testParse(gleamImport, src);
  expect(result.parsed).is.null;
}

function expectParses(src: string): TestParseResult<void> {
  const result = testParse(gleamImport, src);
  console.log(src);
  expect(result.parsed).is.not.null;
  return result;
}

  importSyntaxCases.forEach((c) => {
    if (c.fails) {
      test(c.src, () => expectParseFail(c.src));
    } else {
      test(c.src, () => expectParses(c.src));
    }
  });
