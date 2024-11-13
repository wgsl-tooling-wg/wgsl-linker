import { matchingLexer } from "@wesl/mini-parse";
import { expect, test } from "vitest";
import { mainTokens } from "../MatchWgslD.ts";

test.ignore("lex #import foo", () => {
  const lexer = matchingLexer(`#import foo`, mainTokens);
  const tokens = [1, 2].map(lexer.next);
  expect(tokens.map((t) => t?.kind)).toEqual(["directive", "word"]);
});

test("/* foo */", () => {
  const lexer = matchingLexer(`/* foo */`, mainTokens);
  const tokens = [1, 2, 3].map(lexer.next);
  const tokenKinds = tokens.map((t) => t?.kind);
  expect(tokenKinds).toEqual(["symbol", "word", "symbol"]);
});
