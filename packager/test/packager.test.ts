import { expect, test } from "vitest";
import * as path from "@std/path";
import { packageWgsl } from "../packageWgsl.ts";
import { parseArgs } from "../main.ts";

test("package two wgsl files", async () => {
  const projectDir = path.join(".", "test", "wgsl-package");
  const distDir = path.join(projectDir, "dist");
  const srcDir = path.join(projectDir, "src");
  await Deno.remove(distDir, { recursive: true });
  await Deno.mkdir(distDir);

  const args = parseArgs(
    `--projectDir ${projectDir} --rootDir ${srcDir} --outDir ${distDir}`.split(
      /\s+/,
    ),
  );
  expect(args.projectDir).toEqual(projectDir);
  await packageWgsl(args);
});
