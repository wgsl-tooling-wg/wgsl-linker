import { glob } from "glob";
import path from "node:path";
import { BulkTest, bulkTests } from "wesl-testsuite";
import { NamedPath } from "./parallelTest.ts";
import { dlog } from "berry-pretty";

/* vitest parallelizes per test file,
 * so we split a large test into many files.
 *
 * Accumulate the set of all test file paths,
 * and then splitting that set into parts.
 */

const communityRoot = path.join("..", "..", "..", "community-wgsl");
const numParts = 16;
const allPaths = await loadTests();

/** each parallel-[N].test.ts will use its Nth part of the total test set */
export const pathSets = nParts(allPaths, numParts);

async function loadTests(): Promise<NamedPath[]> {
  const pathSets:NamedPath[] = [];
  for (const bulk of bulkTests) {
    const paths = await loadBulkSet(bulk);
    pathSets.push(...paths);
  }
  return pathSets;
}

async function loadBulkSet(bulk: BulkTest): Promise<NamedPath[]> {
  const baseDir = path.join(communityRoot, bulk.baseDir);
  const includeFiles = bulk.include ?? [];
  const globFiles = await findGlobFiles(
    baseDir,
    bulk.globInclude,
    bulk.exclude,
  );
  const relativePaths: string[] = [...includeFiles, ...globFiles];
  const namePaths: NamedPath[] = relativePaths.map(f => ({
    name: f,
    filePath: path.join(baseDir, f),
  }));
  return namePaths;
}

async function findGlobFiles(
  baseDir: string,
  globs: string[] | undefined,
  exclude: string[] | undefined,
): Promise<string[]> {
  const fullBaseDir = path.resolve(baseDir);
  const cwd = process.cwd();
  const skip = exclude ?? [];
  try {
    process.chdir(fullBaseDir);
    const futurePaths =
      globs?.map(g => glob(g, { ignore: ["node_modules/**"] })) ?? [];
    const pathSets = await Promise.all(futurePaths);
    dlog({fullBaseDir, globs, pathSets});
    const filePaths = pathSets.flat();
    return filePaths.filter(p => !skip.some(s => p.includes(s)));
  } finally {
    dlog("back to", {cwd})
    process.chdir(cwd);
  }
}

/** split an array into n partitions */
function nParts<T>(a: T[], n: number): T[][] {
  const parts: T[][] = new Array(n).fill(0).map(() => []);
  a.forEach((v, i) => parts[i % n].push(v));
  return parts;
}
