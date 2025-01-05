import { mkdir } from "node:fs/promises";
import path from "path";
import { rimraf } from "rimraf";
import { test } from "vitest";
import { packagerCli } from "../packagerCli.js";

test("package two wgsl files", async () => {
  const projectDir = path.join(".", "src", "test", "wgsl-package");
  const distDir = path.join(projectDir, "dist");
  const srcDir = path.join(projectDir, "src");
  await rimraf(distDir);
  await mkdir(distDir);
  packageCli(
    `--projectDir ${projectDir} --rootDir ${srcDir} --outDir ${distDir}`,
  );
  // TODO verify results
});

function packageCli(argsLine: string): Promise<void> {
  return packagerCli(argsLine.split(/\s+/));
}
