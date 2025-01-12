import { _withBaseLogger, NoTags, Parser, TagRecord } from "mini-parse";
import {
  expectNoLog,
  logCatch,
  testParse,
  TestParseResult,
} from "mini-parse/test-util";
import { link } from "../Linker.js";
import { mainTokens } from "../WESLTokens.js";
import { parseWESL, syntheticWeslParseState, WeslAST } from "../ParseWESL.js";

export function testAppParse<T, N extends TagRecord = NoTags>(
  parser: Parser<T, N>,
  src: string,
): TestParseResult<T, N, WeslAST> {
  const appState = syntheticWeslParseState();
  return testParse(parser, src, mainTokens, appState);
}

/** Convenience wrapper to link wgsl for tests.
 * The first module is named "./test.wesl",
 * subsequent modules are named "./file1.wesl", "./file2.wesl", etc.
 */
export function linkTest(...rawWgsl: string[]): string {
  const [root, ...rest] = rawWgsl;
  const restWgsl = Object.fromEntries(
    rest.map((src, i) => [`./file${i + 1}.wesl`, src]),
  );
  const wesl = { "./test.wesl": root, ...restWgsl };

  const srcMap = link(wesl, "test");
  return srcMap.dest;
}

/** link wesl for tests, and return the console log as well */
export function linkWithLog(...rawWgsl: string[]): {
  log: string;
  result: string;
} {
  const { log, logged } = logCatch();
  let result = "???";
  _withBaseLogger(log, () => {
    try {
      result = linkTest(...rawWgsl);
    } catch (e) {}
  });
  return { result, log: logged() };
}

/** parse wesl for testing, and return the AST */
export function parseTest(src: string): WeslAST {
  return expectNoLog(() => parseTestRaw(src));
}

/** test w/o any log collection, to not confuse debugging */
export function parseTestRaw(src: string) {
  return parseWESL(src, undefined, 500);
}
