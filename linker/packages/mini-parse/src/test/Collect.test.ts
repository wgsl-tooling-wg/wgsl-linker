import {
  logCatch,
  testParse,
  testTokens,
  withTracingDisabled,
} from "mini-parse/test-util";
import { expect, test } from "vitest";
import { or, seq, text } from "../ParserCombinator.js";
import { pretty } from "berry-pretty";

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
  const src = "a b c";
  const results: string[] = [];
  const p = seq(
    text("a").tag2("x"),
    text("b")
      .tag2("y")
      .collect(({ tags }) => {
        results.push(`collected: ${tags.x}, ${tags.y}`);
      }),
    "c",
  ).commit();

  testParse(p, src);
  expect(results).toEqual(["collected: a, b"]);
});

test("backtracking", () => {
  const src = "x a b c";
  const results: string[] = [];
  const p = seq(
    "x",
    or(
      seq(
        text("a").tag2("A"), // should not be tagged
        text("N"),
      ).collect(
        () => results.push("collected1"), // should not be called
      ),
      seq("a", text("b").tag2("B"), "c").collect(({ tags }) => {
        const as = tags.A?.[0];
        const bs = tags.B?.[0];
        results.push(`collected2: ${as}, ${bs}`);
      }),
    ),
  ).commit();

  testParse(p, src);
  expect(results).toEqual(["collected2: undefined, b"]);
});
