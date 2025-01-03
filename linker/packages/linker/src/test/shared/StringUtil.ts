import { expect } from "vitest";

/** trim source for test comparisons
 * rm blank lines
 * rm leading indent consistently across remaining lines
 * rm trailing spaces from each line */
export function trimSrc(src: string): string {
  const rawLines = src.split("\n");
  const nonBlankLines = rawLines.filter(l => l.trim() !== "");
  const indents = nonBlankLines.map(l => l.match(/^[ \t]*/)?.[0].length ?? 0);
  if (indents.length === 0) return src;

  const minIndent = indents.reduce((min, i) => Math.min(min, i));

  const indentTrimmed = nonBlankLines.map(l => l.slice(minIndent));
  const noTrailingSpaces = indentTrimmed.map(l => l.trimEnd());

  return noTrailingSpaces.join("\n");
}

export function dropWhile<T>(a: T[], fn: (el: T) => boolean): T[] {
  let skip = 0;
  while (skip < a.length && fn(a[skip])) skip++;

  return a.slice(skip);
}

export function dropRightWhile<T>(a: T[], fn: (el: T) => boolean): T[] {
  let skip = a.length - 1;
  while (skip >= 0 && fn(a[skip])) skip--;

  return a.slice(0, skip + 1);
}

export function matchTrimmed(result: string, expected: string): void {
  const resultTrimmed = trimSrc(result);
  const expectTrimmed = trimSrc(expected);
  if (resultTrimmed !== expectTrimmed) {
    const expectLines = expectTrimmed.split("\n");
    const resultLines = resultTrimmed.split("\n");
    const len = Math.max(expectLines.length, resultLines.length);
    for (let i = 0; i < len; i++) {
      const diff = expectLines[i] !== resultLines[i];
      if (diff) {
        console.log(`...failed.  Line ${i + 1} differs:
  expected: ${expectLines[i]}
    actual: ${resultLines[i] ?? ""}`);
        break;
      }
    }
    console.log(
      `\ntrimmed result:\n${resultTrimmed}\n\ntrimmed expected:\n${expectTrimmed}\n`,
    );
    // console.log(
    //   `\nresult:\n${result}\n\nexpected:\n${expected}\n`,
    // );
  }
  expect(resultTrimmed).toBe(expectTrimmed);
}
