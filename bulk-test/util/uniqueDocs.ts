import { Change, diffLines } from "diff";
import { expandGlob } from "@std/fs";

/* Search through a set of files to find the uniquest ones.
 * Uses a diff library to compare files with each other
 * Files are considered unique if they add a minimum number of lines
 * and the percentage of unique lines in the new file is above a threshold.
 */

/** set of texts that have been delcared unique so far */
export interface SavedText {
  path: string;
  text: string;
}

interface UniquishFilesOptions {
  /** root directory to search */
  rootDir: string;

  /** file suffix to search for */
  suffix?: string;

  /** minimum number of lines added to be considered a new document */
  minAddLines?: number;

  /** fraction of new document that needs to be unique to be considered a new document */
  minAddPercent?: number;

  /** preprocess function to apply to each file */
  preprocessFn?: (s: string) => string;

  /** limit the total number of files to search */
  limitSearch?: number;

  /*  limit the number of saved to check against (unsafe, but saves time) */
  limitCheck?: number;
}

export type DifferenceOptions = Pick<
  UniquishFilesOptions,
  "minAddLines" | "minAddPercent" | "limitCheck"
>;

/** Search through a set of files to find the uniquest ones,
 * via the diff algorithm */
export async function uniquishFiles(
  options: UniquishFilesOptions,
): Promise<string[]> {
  const { rootDir, suffix = "wgsl", limitSearch = 0 } = options;
  const { preprocessFn = (s: string) => s } = options;
  const { minAddLines, minAddPercent, limitCheck } = options;

  // TODO: Don't use chdir ( https://github.com/denoland/deno/issues/25559 )
  Deno.chdir(rootDir);
  const files = (await Array.fromAsync(
    expandGlob(`./**/*.${suffix}`, { exclude: ["node_modules/**"] }),
  )).filter((f) => f.isFile).map((f) => f.path);
  const sorted = await sortBySize(files); // consider shaders in largest first order

  const saved: SavedText[] = [];
  const paths = limitSearch ? sorted.slice(0, limitSearch) : sorted;

  let totalLines = 0;
  let nth = 0;
  for (const path of paths) {
    const orig = await Deno.readTextFile(path);
    const text = preprocessFn(orig);

    console.log("checking", { nth: ++nth, path });
    const diffOpts = { minAddLines, minAddPercent, limitCheck };
    const percentDiff = differentText(saved, text, diffOpts);
    if (percentDiff !== undefined) {
      totalLines += text.split("\n").length;
      console.log("saving", { path, percentDiff, totalLines });
      saved.push({ path, text });
    }
  }

  return saved.map((s) => s.path);
}

/** return % difference if the the text differs significantly from saved texts,
 * otherwise return undefined */
export function differentText(
  saved: SavedText[],
  text: string,
  options: DifferenceOptions,
): number | undefined {
  const { minAddLines = 5, minAddPercent = 0.01, limitCheck = 0 } = options;
  let differentLines = Number.POSITIVE_INFINITY;

  // iterate in reverse order, most recent larger file is likely the same
  const start = saved.length - 1;
  const limitSaveCheck = limitCheck || start; // only check a few of the larger docs for speed
  const end = Math.max(0, start - limitSaveCheck);
  for (let i = start; i >= end; i--) {
    const s = saved[i];
    const changes = diffLines(s.text, text, { newlineIsToken: true });
    const addCount = addLines(changes);
    if (addCount < minAddLines) {
      const failedNth = saved.length - i;
      if (limitCheck > 0 && failedNth > limitCheck) console.log({ failedNth });

      return undefined;
    }
    differentLines = Math.min(differentLines, addCount);
  }
  const textLines = text.split("\n").length;
  const percentAdded = (differentLines / textLines) * 100;
  if (percentAdded > minAddPercent) return percentAdded;
  else return undefined;
}

/** count the number of lines added in these changes */
function addLines(changes: Change[]): number {
  const addChanges = changes.filter((c) => c.added);
  // console.log({addChanges})
  // addChanges.forEach(c => {
  //   console.log({c});
  // });
  const addLineCounts = addChanges.map((c) => c.value.split("\n").length);
  const totalLines = addLineCounts.reduce((a, b) => a + b, 0);
  // console.log({ totalLines });
  return totalLines;
}

/** sort a set of files by size, largest first */
export async function sortBySize(paths: string[]): Promise<string[]> {
  const sizes = await Promise.all(
    paths.map(async (path) => {
      const stats = await Deno.stat(path);
      return { path, size: stats.size };
    }),
  );
  sizes.sort((a, b) => b.size - a.size);
  return sizes.map((s) => s.path);
}
