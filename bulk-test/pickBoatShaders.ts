import { uniquishFiles } from "./util/uniqueDocs.ts";

/* The boat_attack sample shaders have significantly internal duplication
 * This script tries to find the relatively unique shaders for testing.
 * run with e.g. pnpm tsx bin/pickBoatShaders.ts
 *
 * The run takes about 3hrs on my laptop.
 * . (Looks like most of the time is spent in the diff algorithm..)
 */

const boatAttackDir =
  "../../../community-wgsl/unity_web_research/webgpu/wgsl/boat_attack";

const uniqueHlsl = await uniquishFiles({
  rootDir: boatAttackDir,
  suffix: "hlsl",
  minAddLines: 100,
  minAddPercent: 5,
  preprocessFn: removeDirectiveLines,
  // limitSearch: 100,
  // limitCheck: 5
});
const wgsl = uniqueHlsl.map((p) => p.replace(/hlsl$/, "wgsl"));
console.log({ maxArray: 500 }, { wgsl });

function removeDirectiveLines(text: string): string {
  return text.replace(/^#.*$/gm, "");
}
