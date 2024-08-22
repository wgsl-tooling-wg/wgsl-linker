import {
  kind,
  matchOneOf,
  NoTags,
  opt,
  or,
  Parser,
  repeatPlus,
  seq,
  setTraceName,
  TagRecord,
  text,
  tokenMatcher,
  tokens,
  tokenSkipSet,
  tracing,
  withSep,
  withTags,
} from "mini-parse";
import { TreeImportElem } from "./AbstractElems.js";
import {
  ImportTree,
  PathSegment,
  SegmentList,
  SimpleSegment,
  Wildcard,
} from "./ImportTree.js";
import { digits, word } from "./MatchWgslD.js";
import { makeElem } from "./ParseSupport.js";

const gleamImportSymbolSet = "/ { } , ( ) .. . * ;";
const gleamImportSymbol = matchOneOf(gleamImportSymbolSet);

const skipWsSet = new Set(["ws"]);
function skipWs<V, T extends TagRecord>(p: Parser<V, T>): Parser<V, T> {
  return tokenSkipSet(skipWsSet, p);
}
function noSkipWs<V, T extends TagRecord>(p: Parser<V, T>): Parser<V, T> {
  return tokenSkipSet(null, p);
}

export const gleamImportTokens = tokenMatcher({
  ws: /\s+/,
  gleamImportSymbol,
  word,
  digits,
});

const wordToken = kind(gleamImportTokens.word);

// forward reference (for mutual recursion)
let pathTail: Parser<ImportTree, NoTags> = null as any;

const simpleSegment = withTags(
  seq(wordToken.tag("segment"), opt(seq("as", wordToken.tag("as")))).map(
    (r) => {
      const segment = r.tags.segment[0];
      return new SimpleSegment(segment, r.tags.as?.[0]);
    }
  )
);

const wildCard = text("*").map(() => Wildcard._);

const skipWs = new Set(["ws"]);

const segmentList = withTags(
  seq(
    "{",
    tokenSkipSet(
      skipWs,
      withSep(",", () => pathTail, { requireOne: true }).tag("list")
    ),
    "}"
  ).map((r) => {
    const elems = r.tags.list.flat();

    // disallow more than one '*' in a list
    if (elems.filter((e) => e.segments[0] instanceof Wildcard).length > 1) {
      // fail the parser
      return null as unknown as SegmentList; // preserve type inference for success case
    }
    return new SegmentList(elems);
  })
);

const pathSegment = or(simpleSegment, wildCard, segmentList);

pathTail = withTags(
  withSep("/", pathSegment.tag("segments"), { requireOne: true }).map((r) => {
    return new ImportTree(r.tags.segments);
  })
);

const relativePrefix = withTags(
  repeatPlus(seq(or(".", "..").tag("rel"), "/")).map((r) =>
    r.tags.rel.map((r) => new ImportTree([new SimpleSegment(r)]))
  )
);
const relativePath = withTags(
  seq(
    relativePrefix.tag("seg"),
    simpleSegment.map((s) => new ImportTree([s.value])).tag("seg"),
    "/",
    pathTail.tag("seg")
  ).map((r) => r.tags.seg.flat())
);
const packagePath = withTags(
  seq(
    pathSegment.map((r) => new ImportTree([r.value])).tag("seg"),
    "/",
    pathTail.tag("seg")
  ).map((r) => r.tags.seg.flat())
);

const fullPath = tokenSkipSet(
  null,
  seq(kind(gleamImportTokens.ws), or(relativePath, packagePath).tag("path"))
).map((r) => {
  return new ImportTree(r.tags.path.flat());
});

/** parse a Gleam style wgsl import statement. */
export const gleamImport = withTags(
  tokens(
    gleamImportTokens,
    seq("import", fullPath.tag("imports"), opt(";")).map((r) => {
      const e = makeElem("treeImport", r, ["imports"]) as TreeImportElem;
      r.app.state.push(e);
    })
  )
  // ).trace();
);

if (tracing) {
  const names: Record<string, Parser<unknown, TagRecord>> = {
    simpleSegment,
    wildCard,
    segmentList,
    pathSegment,
    pathTail,
    relativePath,
    packagePath,
    fullPath,
    gleamImport,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
