import { dlog } from "berry-pretty";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "vitest";
import { grouped, ModuleRegistry } from "wgsl-linker";

/* vitest parallelizes per test file,
 * so split a large test into many files */

const wgslRoot =
  "../../../community-wgsl/unity_web_research/webgpu/wgsl/boat_attack";
const selected = [
  "unity_webgpu_0000020A44565050.fs.wgsl",
  "unity_webgpu_000001FD4EFA3030.fs.wgsl", // percent: 87.91
  "unity_webgpu_0000014DFB395020.fs.wgsl", // percent: 84.93
  "unity_webgpu_0000017E9E2D81A0.vs.wgsl", // percent: 88.46
  "unity_webgpu_00000277907BA020.fs.wgsl", // percent: 94.51
  "unity_webgpu_000002778F64B030.vs.wgsl", // percent: 80.51
  "unity_webgpu_000001F972AC3D10.vs.wgsl", // percent: 88.1
  "unity_webgpu_0000026E57303490.fs.wgsl", // percent: 83.46
  "unity_webgpu_0000027790A29030.fs.wgsl", // percent: 85.15
  "unity_webgpu_0000020A452CBA00.vs.wgsl", // percent: 85.54
  "unity_webgpu_0000026E59EE1060.fs.wgsl", // percent: 79.09
  "unity_webgpu_0000027196735090.vs.wgsl", // percent: 73.95
  "unity_webgpu_0000014C8AC70090.vs.wgsl", // percent: 41.31
  "unity_webgpu_0000026E5684E3F0.vs.wgsl", // percent: 44.55
  "unity_webgpu_000001AC1A2104D0.vs.wgsl", // percent: 59.44
  "unity_webgpu_000002778F5FFAB0.cs.wgsl", // percent: 75.98
  "unity_webgpu_00000232C7146770.vs.wgsl", // percent: 66.67
  "unity_webgpu_0000014C881FEE40.fs.wgsl", // percent: 29.41
  "unity_webgpu_00000232C59F6510.fs.wgsl", // percent: 53.19
  "unity_webgpu_000002778F5A9CB0.vs.wgsl", // percent: 24.1
  "unity_webgpu_0000026E55136DB0.vs.wgsl", // percent: 56.41
  "unity_webgpu_0000017E9CE2DAA0.fs.wgsl", // percent: 19.57
];
const numParts = 16;

// tests will use these partitions to test their portion of the file set
export const boatParts = nParts(selected, numParts);

/** test files run this to run vite tests for all wgsl files in their partition.
 * Each test simple runs the parser to validate that it runs w/o error.
 * (more validation TBD)
 * @param fileNames wgsl file paths to load and parse */
export function testWgslFiles(fileNames: string[]) {
  fileNames.forEach(file => {
    const filePath = path.join(wgslRoot, file);
    test(file, async () => {
      const text = await fs.readFile(filePath, { encoding: "utf8" });
      const registry = new ModuleRegistry({ wgsl: { [file]: text } });
      registry.parsed();
    });
  });
}

/** split an array into n partitions */
function nParts<T>(a: T[], n: number): T[][] {
  const parts: T[][] = new Array(n).fill(0).map(() => []);
  a.forEach((v, i) => parts[i % n].push(v));
  return parts;
}
