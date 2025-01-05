import {
  enableTracing,
  matchingLexer,
  matchOneOf,
  NoTags,
  OptParserResult,
  Parser,
  TagRecord,
  TokenMatcher,
  tokenMatcher,
  tracing,
  _withBaseLogger,
  AppState,
} from "mini-parse";
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
  stable: any;
}

/** utility for testing parsers */
export function testParse<T, N extends TagRecord = NoTags, S = any>(
  p: Parser<T, N>,
  src: string,
  tokenMatcher: TokenMatcher = testTokens,
  appState: AppState<S> = { context: {} as S, stable: [] },
): TestParseResult<T, N, S> {
  const lexer = matchingLexer(src, tokenMatcher);
  const parsed = p.parse({ lexer, appState: appState, maxParseCount: 1000 });
  return { parsed, position: lexer.position(), stable: appState.stable };
}

/** run a test function and expect that no error logs are produced */
export function expectNoLog<T>(fn: () => T): T {
  const { log, logged } = logCatch();
  let result: T | undefined = undefined;

  try {
    result = _withBaseLogger(log, fn);
  } finally {
    if (logged()) {
      console.log(logged());
    }
    expect(logged()).toBe("");
  }
  return result;
}

/** run a test with tracing facility disabled
 * (e.g. if the tracing facility might interfere with the test) */
export function withTracingDisabled(fn: () => void): void {
  const tracingWasEnabled = tracing;
  enableTracing(false);
  try {
    fn();
  } finally {
    enableTracing(tracingWasEnabled);
  }
}
