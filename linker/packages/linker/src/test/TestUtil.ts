import { NoTags, Parser, TagRecord } from "mini-parse";
import { expectNoLog, testParse, TestParseResult } from "mini-parse/test-util";
import { TaskContext } from "vitest";
import { AbstractElem } from "../AbstractElems.js";
import { linkWesl } from "../Linker2.js";
import { mainTokens } from "../MatchWgslD.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { blankWeslParseState, parseWESL, WeslAST } from "../ParseWESL.js";

export function testAppParse<T, N extends TagRecord = NoTags>(
  parser: Parser<T, N>,
  src: string,
): TestParseResult<T, N, WeslAST> {
  const appState = blankWeslParseState();
  return testParse(parser, src, mainTokens, appState);
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

export function testParseWgsl(src: string): AbstractElem[] {
  return expectNoLog(() => parseWESL(src, undefined, 500).elems);
}

export function expectWgsl(ctx: TaskContext): void {
  testParseWgsl(ctx.task.name);
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

export function parse2Test(src: string): WeslAST {
  return expectNoLog(() => parseWESL(src, undefined, 500));
}
