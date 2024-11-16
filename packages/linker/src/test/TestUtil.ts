import { _withBaseLogger, NoTags, Parser, TagRecord } from "mini-parse";
import { logCatch, testParse, TestParseResult } from "mini-parse/test-util";
import { expect } from "vitest";
import { AbstractElem } from "../AbstractElems.js";
import { mainTokens } from "../MatchWgslD.js";
import { ModuleRegistry } from "../ModuleRegistry.js";

export function testAppParse<T, N extends TagRecord = NoTags>(
  parser: Parser<T, N>,
  src: string,
): TestParseResult<T, N, AbstractElem> {
  return testParse(parser, src, mainTokens);
}

/** Convenience wrapper to link wgsl for tests.
 * The first file is named "root.wgsl", subsequent files are named "file1.wgsl", "file2.wgsl", etc.
 */
export function linkTest(...rawWgsl: string[]): string {
  return linkTestOpts({}, ...rawWgsl);
}

export interface LinkTestOpts {
  runtimeParams?: Record<string, any>;
}

/** Convenience wrapper to link wgsl for tests, with load and link options. */
export function linkTestOpts(opts: LinkTestOpts, ...rawWgsl: string[]): string {
  const [root, ...rest] = rawWgsl;
  const { runtimeParams } = opts;

  const restWgsl = Object.fromEntries(
    rest.map((src, i) => [`./file${i + 1}.wgsl`, src]),
  );
  const wgsl = { "./root.wgsl": root, ...restWgsl };

  const registry = new ModuleRegistry({ wgsl });
  return registry.link("./root", runtimeParams);
}

// TODO drop this in favor of mini-parse/test-util
export function expectNoLog<T>(fn: () => T): T {
  const { log, logged } = logCatch();
  const result = _withBaseLogger(log, fn);
  if (logged()) {
    console.log(logged());
  }
  expect(logged()).toBe("");
  return result;
}
