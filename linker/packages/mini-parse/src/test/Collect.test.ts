import {
  logCatch,
  testParse,
  testTokens,
  withTracingDisabled,
} from "mini-parse/test-util";
import { expect, test } from "vitest";
import { seq, text } from "../ParserCombinator.js";

test("collect runs a fn on commit", () => {
  const src = "a b c";
  const results: string[] = [];
  const p = seq(
    "a",
    text("b").collect(() => results.push("collected")),
    "c",
  )
    .map(() => results.push("parsed"))
    .commit();

  testParse(p, src);
  expect(results).toEqual(["parsed", "collected"]);
});

test("collect fn sees tags", () => {
  const src = "a b";
  const results: string[] = [];
  const p = seq(
    text("a").tag2("x"),
    text("b")
      .tag2("y")
      .collect((tags: Record<string, any>) => {
        results.push(`collected: ${tags.x}, ${tags.y}`);
      }),
    "c",
  ).commit();

  testParse(p, src);
  expect(results).toEqual(["collected: a, b"]);
});
