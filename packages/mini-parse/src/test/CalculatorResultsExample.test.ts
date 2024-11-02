import { testParse } from "mini-parse/test-util";
import { expect, test } from "vitest";
import { calcTokens } from "../examples/CalculatorExample.js";
import {
  power,
  product,
  resultsStatement,
  sum,
} from "../examples/CalculatorResultsExample.js";
import { Parser } from "../Parser.js";

test("power 2 ^ 4", () => {
  const { parsed } = testParse(power, "2 ^ 3", calcTokens);
  expect(parsed?.value).eq(8);
});

test("product 3 * 4 ", () => {
  const { parsed } = testParse(product, "3 * 4", calcTokens);
  expect(parsed?.value).eq(12);
});

test("sum 3 + 4 ", () => {
  const { parsed } = testParse(sum, "3 + 4", calcTokens);
  expect(parsed?.value).eq(7);
});

test("parse 3 + 4 * 8", () => {
  const result = calcTest(resultsStatement, "3 + 4 * 8");
  expect(result).eq(35);
});

test("parse 3 * 4 + 8", () => {
  const result = calcTest(resultsStatement, "3 * 4 + 8");
  expect(result).eq(20);
});

test("parse 3^2 * 4 + 11", () => {
  const result = calcTest(resultsStatement, "3^2 *4 + 11");
  expect(result).eq(47);
});

test("parse 2^4^2", () => {
  const result = calcTest(resultsStatement, "2^4^2");
  expect(result).eq(2 ** (4 ** 2));
});

function calcTest(parser: Parser<number>, src: string): number | undefined {
  const { parsed } = testParse(parser, src, calcTokens);
  return parsed?.value;
}
