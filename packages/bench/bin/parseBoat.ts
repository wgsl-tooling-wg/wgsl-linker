import fs from "fs/promises";
import path from "path";
import { ModuleRegistry } from "wgsl-linker";
import {WgslReflect} from "wgsl_reflect";

export const boatAttackDir =
  "../../../community-wgsl/unity_web_research/webgpu/wgsl/boat_attack";

run();

async function run() {
  const filePath = path.join(
    boatAttackDir,
    "unity_webgpu_0000026E5689B260.fs.wgsl",
  );
  const text = await fs.readFile(filePath, { encoding: "utf8" });
  // parseText(filePath, text);
  reflectText(filePath, text);
  console.profile();
  // parseText(filePath, text);
  reflectText(filePath, text);
  console.profileEnd();
}

function parseText(filePath: string, text: string): void {
  const registry = new ModuleRegistry({ wgsl: { [filePath]: text } });

  // registry.link(path);
  registry.parsed();
}

function reflectText(filePath: string, text: string): void {
  const reflect = new WgslReflect(text);
}