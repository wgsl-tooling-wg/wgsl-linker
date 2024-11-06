import { glob } from "glob";
import fs from "node:fs/promises";
import { test } from "vitest";
import { ModuleRegistry } from "wgsl-linker";

const wgslRoot = "../../../community-wgsl/webgpu-samples";

// these require composing some wgsl files together, so just skip em for now
const exclude = ["skinnedMesh", "cornell"];

const texts = await loadFiles(exclude);

texts.forEach(([path, text]) => {
  const testName = path.replace(wgslRoot, "");
  test(testName, () => {
    const registry = new ModuleRegistry({ wgsl: { [path]: text } });
    registry.link(path);
  });
});

async function loadFiles(exclude: string[]): Promise<[string, string][]> {
  const files = await glob(`${wgslRoot}/**/*.wgsl`, {
    ignore: ["node_modules/**"],
  });
  const activeFiles = files.filter(
    path => !exclude.some(e => path.includes(e)),
  );
  const futureEntries = activeFiles.map(async path => {
    const futureText = await fs.readFile(path, { encoding: "utf8" });
    return [path, futureText] as [string, string];
  });
  const entries = await Promise.all(futureEntries);
  return entries;
}
