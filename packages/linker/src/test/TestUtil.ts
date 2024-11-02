import { NoTags, Parser, TagRecord } from "mini-parse";
import { testParse, TestParseResult } from "mini-parse/test-util";

import { AbstractElem } from "../AbstractElems.js";
import { mainTokens } from "../MatchWgslD.js";
import {
  ModuleRegistry,
  RegisterGenerator,
  Template,
} from "../ModuleRegistry.js";

export function testAppParse<T, N extends TagRecord = NoTags>(
  parser: Parser<T, N>,
  src: string
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
  templates?: Template[];
  generators?: RegisterGenerator[];
  runtimeParams?: Record<string, any>;
}

/** Convenience wrapper to link wgsl for tests, with load and link options. */
export function linkTestOpts(
  opts: LinkTestOpts,
  ...rawWgsl: string[]
): string {
  const [root, ...rest] = rawWgsl;
  const { templates, generators, runtimeParams } = opts;

  const restWgsl = Object.fromEntries(
    rest.map((src, i) => [`./file${i + 1}.wgsl`, src])
  );
  const wgsl = { "./root.wgsl": root, ...restWgsl };

  const registry = new ModuleRegistry({ wgsl, templates, generators });
  return registry.link("./root", runtimeParams);
}
