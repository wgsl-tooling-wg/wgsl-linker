import { SrcMap, SrcMapEntry } from "mini-parse";
import { last, scan } from "./Util.ts";

/** specify a start,end portion of a string to be replaced */
export interface SliceReplace {
  start: number;
  end: number;
  replacement: string;
}

interface SlicingProgress {
  srcPos: number;
  destPos: number;
  results: string[];
  entries: SrcMapEntry[];
}

/**
 * Rewrite a string by replacing segments them with provided texts.
 *
 * example:
 * src:
 *  aaabbbbbc
 *     ^    ^
 *     St   End Repl='XXX'
 *
 * returns a srcMap with the new text and mappings from the original text to the new text
 *  aaaXXXc
 */
export function sliceReplace(
  src: string,
  slices: SliceReplace[],
  start = 0,
  end = src.length,
): SrcMap {
  const sorted = [...slices].sort((a, b) => a.start - b.start);
  const initProgress = { srcPos: start, destPos: 0, results: [], entries: [] };
  const slicePogress = scan(sorted, oneSlice, initProgress);
  const lastProgress = finalProgress2(slicePogress);

  const { results, entries } = lastProgress;
  const text = results.join("");
  const srcMap = new SrcMap(text, entries);
  return srcMap;

  /** visit one slice, return progress */
  function oneSlice(
    slice: SliceReplace,
    progress: SlicingProgress,
  ): SlicingProgress {
    // dlog({ slice });
    // update text with copy and replacement
    const copyText = src.slice(progress.srcPos, slice.start);
    const copied = replaceOne(copyText, slice.start, progress);
    const replaced = replaceOne(slice.replacement, slice.end, copied);

    return replaced;
  }

  /** add provided text to the result, advance src position, and add a srcMap entry
   * @return the accumulated progress */
  function replaceOne(
    replacement: string,
    newSrcPos: number,
    progress: SlicingProgress,
  ): SlicingProgress {
    const { destPos, entries } = progress;
    const newDestPos = destPos + replacement.length;

    // new srcMap entry if there is a replacement text (otherwise there's nothing to map dest to src)
    let newEntries = entries;
    if (replacement) {
      const { srcPos } = progress;
      newEntries = entries.concat({
        src,
        srcStart: srcPos,
        srcEnd: newSrcPos,
        destStart: destPos,
        destEnd: newDestPos,
      });
    }

    // update results text and progress
    const { results } = progress;
    const newResults = replacement ? results.concat(replacement) : results;
    return {
      srcPos: newSrcPos,
      destPos: newDestPos,
      results: newResults,
      entries: newEntries,
    };
  }

  /**
   * If there's any trailing text uncovered by the slices before the end,
   * add a result and srcMap entry
   *
   * @return the accumulated progress
   */
  function finalProgress2(progress: SlicingProgress[]): SlicingProgress {
    const lastProgress = last(progress) ?? initProgress;
    const { srcPos } = lastProgress;
    return replaceOne(src.slice(srcPos, end), end, lastProgress);
  }
}

const tokenRegex = /\b(\w+)\b/gi;
/** find strings in a text -
 * found strings must be 'tokens', surrounded by spaces or punctuation
 *
 * @return SliceReplace elements
 */
export function sliceWords(
  text: string,
  replace: Record<string, string>,
): SliceReplace[] {
  const tokens = [...text.matchAll(tokenRegex)];
  const find = Object.keys(replace);
  const matches = tokens.filter(m => find.includes(m[0]));
  const slices = matches.map(m => {
    const start = m.index;
    const end = start + m[0].length;
    const replacement = replace[m[0]];
    return { start, end, replacement };
  });
  return slices;
}
