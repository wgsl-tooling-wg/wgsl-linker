import fs from "node:fs/promises";
import { test } from "vitest";
import { ModuleRegistry } from "wgsl-linker";

export interface NamedPath {
  name: string; // test name
  filePath: string; // path relative to project root (package.json dir)
}


// TODO more validation, not just parsing

/** test files run this to run vite tests for all wgsl files in their partition.
 * Each test simple runs the parser to validate that it runs w/o error.
 * @param fileNames wgsl file paths to load and parse */
export function testWgslFiles(namedPaths: NamedPath[]) {
  namedPaths.forEach(({ name, filePath }) => {
    test(name, async () => {
      const text = await fs.readFile(filePath, { encoding: "utf8" });
      const registry = new ModuleRegistry({ wgsl: { [name]: text } });
      registry.parsed();
      // registry.link(name);
    });
  });
}