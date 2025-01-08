import { mkdir, readFile } from "node:fs/promises";
import path from "path";
import { rimraf } from "rimraf";
import { expect, test } from "vitest";
import { packagerCli } from "../packagerCli.js";

test("package two wgsl files", async () => {
  const projectDir = path.join(".", "src", "test", "wgsl-package");
  const distDir = path.join(projectDir, "dist");
  const srcDir = path.join(projectDir, "src");
  await rimraf(distDir);
  await mkdir(distDir);
  await packageCli(
    `--projectDir ${projectDir} --rootDir ${srcDir} --outDir ${distDir}`,
  );
  const result = await readFile(path.join(distDir, "wgslBundle.js"), "utf8");
  expect(result).toMatchInlineSnapshot(`
    "
    export const wgslBundle = {
      "name": "test-wgsl-package",
      "version": "0.1.1",
      "edition": "wesl_unstable_2024_1",
      "modules": {
        "util.wgsl": "fn foo() {}",
        "lib.wesl": "import ./util.wgsl\\n"
      }
    }

    export default wgslBundle;
      "
  `);
});

function packageCli(argsLine: string): Promise<void> {
  return packagerCli(argsLine.split(/\s+/));
}
