import { test } from "vitest";
import { glob } from "glob";
import { dlog } from "berry-pretty";
import fs  from "node:fs/promises";
import { ModuleRegistry } from "wgsl-linker";

const wgslRoot = "../../../community-wgsl/webgpu-samples"

const texts = await loadFiles();

texts.forEach(([path, text]) => {
  const testName = path.replace(wgslRoot, "");
  test(testName, () => {
    const registry = new ModuleRegistry({ wgsl: { [path]: text } });
    registry.link(path);
  });
});

async function loadFiles(): Promise<[string, string][]> {
  const files = await glob(`${wgslRoot}/**/*.wgsl`, {
    ignore: "node_modules/**",
  });
  const futureEntries = files.map(async path => {
    const futureText = await fs.readFile(path, { encoding: "utf8" });
    return [path, futureText] as [string, string];
  });
  const entries = await Promise.all(futureEntries);
  return entries;
}

