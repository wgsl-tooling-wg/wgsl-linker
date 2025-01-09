import { _withBaseLogger, NoTags, Parser, TagRecord } from "mini-parse";
import {
  expectNoLog,
  logCatch,
  testParse,
  TestParseResult,
} from "mini-parse/test-util";
import { linkWesl } from "../Linker2.js";
import { mainTokens } from "../MatchWgslD.js";
import { parseWESL, syntheticWeslParseState, WeslAST } from "../ParseWESL.js";

export function testAppParse<T, N extends TagRecord = NoTags>(
  parser: Parser<T, N>,
  src: string,
): TestParseResult<T, N, WeslAST> {
  const appState = syntheticWeslParseState();
  return testParse(parser, src, mainTokens, appState);
}

/** Convenience wrapper to link wgsl for tests.
 * The first module is named "package::root",
 * subsequent modules are named "package::file1", "package::file2", etc.
 */
export function link2Test(...rawWgsl: string[]): string {
  const [root, ...rest] = rawWgsl;
  const restWgsl = Object.fromEntries(
    rest.map((src, i) => [`package::file${i + 1}`, src]),
  );
  const wesl = { "package::root": root, ...restWgsl };

  const srcMap = linkWesl(wesl, "root");
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
      result = link2Test(...rawWgsl);
    } catch (e) {}
  });
  return { result, log: logged() };
}

export function parse2Test(src: string): WeslAST {
  return expectNoLog(() => parseWESL(src, undefined, 500));
}
