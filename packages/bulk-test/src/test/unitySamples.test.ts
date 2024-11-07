import { glob } from "glob";
import fs from "node:fs/promises";
import { test } from "vitest";
import { ModuleRegistry } from "wgsl-linker";
import { dlog } from "berry-pretty";

const wgslRoot = "../../../community-wgsl/unity_web_research";

// these require composing some wgsl files together, so just skip em for now
const exclude:string[] = [];

const texts = await loadFiles(exclude);

texts.forEach(([path, text]) => {
  const testName = path.replace(wgslRoot, "");
  test(testName, () => {
    const registry = new ModuleRegistry({ wgsl: { [path]: text } });
    // registry.link(path); // TODO fix issue with alias references
    registry.parsed();
  });
});

async function loadFiles(exclude: string[]): Promise<[string, string][]> {
  const files = await glob(`${wgslRoot}/**/*.wgsl`, {
    ignore: ["node_modules/**"],
  });
  const activeFiles = files.filter(
    path => !exclude.some(e => path.includes(e)),
  ).slice(0, 10);
  const futureEntries = activeFiles.map(async path => {
    const text = await fs.readFile(path, { encoding: "utf8" });
    return [path, text] as [string, string];
  });
  const entries = await Promise.all(futureEntries);
  return entries;
}
