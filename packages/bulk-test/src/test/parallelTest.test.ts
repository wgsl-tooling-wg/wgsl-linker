import fs from "node:fs/promises";
import { test } from "vitest";
import { ModuleRegistry } from "wgsl-linker";
import { expectNoLog } from "mini-parse/test-util";
import { findBulkTestPaths } from "../parallelDriver.ts";

export interface NamedPath {
  name: string; // test name
  filePath: string; // path relative to project root (package.json dir)
}

const allPaths = await findBulkTestPaths();

testWgslFiles(allPaths);

/** test files run this to run vite tests for all wgsl files in their partition.
 * Each test simple runs the parser to validate that it runs w/o error.
 * @param fileNames wgsl file paths to load and parse */
export function testWgslFiles(namedPaths: NamedPath[]) {
  namedPaths.forEach(({ name, filePath }) => {
    const shortPath = "./" + name;
    test(name, async () => {
      const text = await fs.readFile(filePath, { encoding: "utf8" });
      expectNoLog(() => {
        const registry = new ModuleRegistry({ wgsl: { [shortPath]: text } });
        registry.parsed();

        // TODO-lee more validation, not just parsing
        // registry.link(shortPath);
      });
    });
  });
}
