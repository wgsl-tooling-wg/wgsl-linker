import { ExtendedResult, ParserContext } from "./Parser.js";
import { logger, parserLog } from "./ParserTracing.js";
import { SrcMap } from "./SrcMap.js";

/** log an message along with the source line and a caret indicating the error position in the line
 * @param pos is the position the source string, or if src is a SrcMap, then
 *  pos is the position in the dest (e.g. preprocessed) text
 */
export function srcLog(
  src: string | SrcMap,
  pos: number | [number, number],
  ...msgs: any[]
): void {
  logInternal(logger, src, pos, ...msgs);
}

/** log a message along with src line, but only if tracing is active in the current parser */
export function srcTrace(
  src: string | SrcMap,
  pos: number | [number, number],
  ...msgs: any[]
): void {
  logInternal(parserLog, src, pos, ...msgs);
}

export function resultLog(
  result: ExtendedResult<any, any>,
  ...msgs: any[]
): void {
  const { src, srcMap, start, end } = result;
  srcLog(srcMap ?? src, [start, end - 1], ...msgs);
}

export function ctxLog(ctx: ParserContext, ...msgs: any[]): void {
  const src = ctx.srcMap ?? ctx.lexer.src;
  srcLog(src, ctx.lexer.position(), ...msgs);
}

/**
 * @param destPos  - position in the dest (e.g. preprocessed) text
 */
function logInternal(
  log: typeof console.log,
  srcOrSrcMap: string | SrcMap,
  destPos: number | [number, number],
  ...msgs: any[]
): void {
  if (typeof srcOrSrcMap === "string") {
    logInternalSrc(log, srcOrSrcMap, destPos, ...msgs);
    return;
  }
  const { src, positions } = mapSrcPositions(srcOrSrcMap, destPos);

  logInternalSrc(log, src, positions, ...msgs);
}

interface SrcPositions {
  positions: number | [number, number];
  src: string;
}

function mapSrcPositions(
  srcMap: SrcMap,
  destPos: number | [number, number],
): SrcPositions {
  const srcPos = srcMap.mapPositions(...[destPos].flat());
  const { src } = srcPos[0];

  let positions: [number, number] | number;
  if (srcPos[1]?.src === src) {
    positions = srcPos.map((p) => p.position) as [number, number];
  } else {
    positions = srcPos[0].position;
  }

  return { src, positions };
}

function logInternalSrc(
  log: typeof console.log,
  src: string,
  pos: number | [number, number],
  ...msgs: any[]
): void {
  log(...msgs);
  const { line, lineNum, linePos, linePos2 } = srcLine(src, pos);
  log(line, `  Ln ${lineNum}`);
  const caret = carets(linePos, linePos2);
  log(caret);
}

function carets(linePos: number, linePos2?: number): string {
  const firstCaret = " ".repeat(linePos) + "^";
  let secondCaret = "";
  if (linePos2 && linePos2 > linePos) {
    secondCaret = " ".repeat(linePos2 - linePos - 1) + "^";
  }
  return firstCaret + secondCaret;
}

// map from src strings to line start positions
const startCache = new Map<string, number[]>();

interface SrcLine {
  /** src line w/o newline */
  line: string;

  /** requested position relative to line start */
  linePos: number;

  /** requested position2 relative to line start */
  linePos2?: number;

  /** line number in the src (first line is #1) */
  lineNum: number;
}

/** return the line in the src containing a given character postion */
export function srcLine(
  src: string,
  position: number | [number, number],
): SrcLine {
  let pos: number;
  let pos2: number | undefined;
  if (typeof position === "number") {
    pos = position;
  } else {
    [pos, pos2] = position;
  }
  const starts = getStarts(src);

  let start = 0;
  let end = starts.length - 1;

  // short circuit search if pos is after last line start
  if (pos >= starts[end]) {
    start = end;
  }

  // binary search to find start,end positions that surround provided pos
  while (start + 1 < end) {
    const mid = (start + end) >> 1;
    if (pos >= starts[mid]) {
      start = mid;
    } else {
      end = mid;
    }
  }

  let linePos2: number | undefined;
  if (pos2 !== undefined && pos2 >= starts[start] && pos2 < starts[end]) {
    linePos2 = pos2 - starts[start];
  }

  // get line with possible trailing newline
  const lineNl = src.slice(starts[start], starts[start + 1] || src.length);

  // return line without trailing newline
  const line = lineNl.slice(-1) === "\n" ? lineNl.slice(0, -1) : lineNl;

  return { line, linePos: pos - starts[start], linePos2, lineNum: start + 1 };
}

/** return an array of the character positions of the start of each line in the src.
 * cached to avoid recomputation */
function getStarts(src: string): number[] {
  const found = startCache.get(src);
  if (found) return found;
  const starts = [...src.matchAll(/\n/g)].map((m) => m.index! + 1);
  starts.unshift(0);
  startCache.set(src, starts);

  return starts;
}
