/* handle #if #else #endif */
import {
    any,
    anyThrough,
    eof,
    ExtendedResult,
    kind,
    makeEolf,
    matchingLexer,
    matchOneOf,
    opt,
    or,
    Parser,
    repeat,
    req,
    resultLog,
    seq,
    setTraceName,
    srcLog,
    SrcMap,
    SrcMapEntry,
    TagRecord,
    tokenMatcher,
    tokenSkipSet,
    tracing
} from "mini-parse";
import { directive, eol } from "./MatchWgslD.js";
import { ParseState } from "./ParseWgslD.js";

export const conditionalsTokens = tokenMatcher(
  {
    directive,
    eol,
    ws: /[ \t]+/,
    symbol: matchOneOf("// !"),
    word: /[^\s\n]+/,
  },
  "conditionals",
);

const eolf = makeEolf(conditionalsTokens, conditionalsTokens.ws);

const ifDirective: Parser<any> = seq(
  "#if",
  seq(
    opt("!").tag("invert"),
    req(kind(conditionalsTokens.word).tag("name")),
    eolf,
  ),
).map(r => {
  // extract args
  const ifArg = r.tags["name"]?.[0] as string;
  const invert = r.tags["invert"]?.[0] === "!";

  // lookup whether #if arg is truthy or not in paramsa, and invert for ! prefix
  const { params } = r.app.state;
  const arg = !!params[ifArg];
  const truthy = invert ? !arg : arg;

  pushIfState(r, truthy);
});

const elseDirective = seq("#else", eolf).map(r => {
  const oldTruth = popIfState(r);
  if (oldTruth === undefined) resultLog(r, "unmatched #else");
  pushIfState(r, !oldTruth);
});

const endifDirective = seq("#endif", eolf).map(r => {
  const oldTruth = popIfState(r);
  if (oldTruth === undefined) resultLog(r, "unmatched #endif");
});

const directiveLine = seq(
  opt("//"),
  or(ifDirective, elseDirective, endifDirective),
);

// special case for last line which might not have a newline
const simpleLine = anyThrough("\n");
const lastLine = seq(any(), repeat(any()), eolf);

const regularLine = or(simpleLine, lastLine).map(r => {
  if (!skippingIfBody(r)) {
    // resultLog(r, "regularLine", r.start, r.end);
    pushLine(r);
  }
});

// don't skip whitespace for regular lines - we want to copy them exactly.
const line = tokenSkipSet(null, regularLine);

const srcLines = seq(repeat(or(directiveLine, line)), eof());

function skippingIfBody(
  r: ExtendedResult<unknown, TagRecord, ParseState>,
): boolean {
  const ifStack = r.app.state.ifStack as IfStackElem[];
  return !ifStack.every(({ truthy }) => truthy);
}

function pushIfState<T>(
  r: ExtendedResult<T, TagRecord, ParseState>,
  truthy: boolean,
): void {
  r.app.state.ifStack.push({ truthy, pos: r });
}

function popIfState<T>(
  r: ExtendedResult<T, TagRecord, ParseState>,
): boolean | undefined {
  const ifStack = r.app.state.ifStack as IfStackElem[];
  const result = ifStack.pop();
  return result?.truthy;
}

function pushLine(r: ExtendedResult<any>): void {
  const line = r.src.slice(r.start, r.end);
  const { state } = r.app;
  const entry: SrcMapEntry = {
    src: r.src,
    srcStart: r.start,
    srcEnd: r.end,
    destStart: state.destLength,
    destEnd: state.destLength + line.length,
  };
  state.srcMapEntries.push(entry);
  state.destLength += line.length;
  state.lines.push(line);
}

interface IfStackElem {
  truthy: boolean;
  pos: { start: number; end: number };
}

/** preprocess a src string to handle #if #else #endif, etc. */
export function processConditionals(
  src: string,
  params: Record<string, any>,
): SrcMap {
  const lines: string[] = [];
  const srcMapEntries: SrcMapEntry[] = [];
  const ifStack: IfStackElem[] = [];
  srcLines.parse({
    lexer: matchingLexer(src, conditionalsTokens),
    app: {
      context: {},
      state: { ifStack, lines, srcMapEntries, destLength: 0, params },
    },
    maxParseCount: 1e6,
  });
  if (ifStack.length > 0) {
    const { pos } = ifStack.slice(-1)[0];
    srcLog(src, [pos.start, pos.end], "unmatched #if/#else");
  }

  const text = lines.join("");
  const srcMap = new SrcMap(text);
  srcMap.addEntries(srcMapEntries);
  srcMap.compact();
  return srcMap;
}

/** debug for recognizer */
if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    ifDirective,
    elseDirective,
    endifDirective,
    directiveLine,
    simpleLine,
    lastLine,
    line,
    srcLines,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
