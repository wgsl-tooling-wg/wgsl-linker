import fs from "fs/promises";
import {
  DifferenceOptions,
  differentText,
  SavedText,
  sortBySize,
} from "../src/util/uniqueDocs.ts";
import { dlog } from "berry-pretty";

/*
 * The pickBoatShaders script diff compares hlsl files, incrementally and
 * uses that to select a plausible set of wgsl shaders. (The wgsl is machine
 * generated from hlsl).
 *
 * This script diff compares the collected wgsl files, testing whether
 * any are duplicative of the others in the plausible set.
*/
export const boatAttackDir =
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

const texts = await loadTexts(selected);
checkDifferences(texts);

async function loadTexts(paths: string[]): Promise<SavedText[]> {
  process.chdir(boatAttackDir);
  const sorted = await sortBySize(paths);
  const futureTexts = sorted.map(async path => {
    const text = await fs.readFile(path, { encoding: "utf8" });
    return { path, text };
  });

  return Promise.all(futureTexts);
}

function checkDifferences(texts: SavedText[]): void {
  texts.forEach((t, i) => {
    const before = texts.slice(0, i);
    const after = texts.slice(i + 1);
    const otherTexts = [...before, ...after];
    const opts: DifferenceOptions = {
      minAddLines: 0,
      limitCheck: 0,
      minAddPercent: 0,
    };
    const percent = differentText(otherTexts, t.text, opts);
    dlog({ path: t.path, percent });
  });
}