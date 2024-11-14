import { testParse } from "@wesl/mini-parse/test-util";
import { expect, test } from "vitest";
import { importSyntaxCases } from "wesl-testsuite";
import { gleamImport } from "../GleamImport.ts";

function expectParseFail(src: string): void {
  const result = testParse(gleamImport, src);
  expect(result.parsed).toBeNull();
}

function expectParses(src: string) {
  const result = testParse(gleamImport, src);
  expect(result.parsed).not.toBeNull();
}

importSyntaxCases.forEach(c => {
  if (c.fails) {
    test(c.src, () => expectParseFail(c.src));
  } else {
    test(c.src, () => expectParses(c.src));
  }
});
