import { matchingLexer, matchOneOf, OptParserResult, Parser, TokenMatcher, tokenMatcher, _withBaseLogger, TagRecord, NoTags } from "mini-parse";
import { expect } from "vitest";
import { logCatch } from "./LogCatcher.js";

const symbolSet =
  "& && -> @ / ! [ ] { } : , = == != > >= < << <= % - -- ' \"" +
  ". + ++ | || ( ) ; * ~ ^ // /* */ += -= *= /= %= &= |= ^= >>= <<= <<";
export const testTokens = tokenMatcher({
  directive: /#[a-zA-Z_]\w*/,
  word: /[a-zA-Z_]\w*/,
  attr: /@[a-zA-Z_]\w*/,
  symbol: matchOneOf(symbolSet),
  digits: /\d+/,
  ws: /\s+/,
});

export interface TestParseResult<T, N extends TagRecord = NoTags, S = any> {
  parsed: OptParserResult<T, N>;
  position: number;
  appState: S[];
}

/** utility for testing parsers */
export function testParse<T, N extends TagRecord = NoTags, S = any>(
  p: Parser<T, N>,
  src: string,
  tokenMatcher: TokenMatcher = testTokens
): TestParseResult<T, N, S> {
  const lexer = matchingLexer(src, tokenMatcher);
  const app = {
    state: [],
    context: undefined,
  };
  const parsed = p.parse({ lexer, app, maxParseCount: 1000 });
  return { parsed, position: lexer.position(), appState: app.state };
}

/** run a test function and expect that no error logs are produced */
export function expectNoLogErr<T>(fn: () => T): T {
  const { log, logged } = logCatch();
  const result = _withBaseLogger(log, fn);
  expect(logged()).eq("");
  return result;
}
