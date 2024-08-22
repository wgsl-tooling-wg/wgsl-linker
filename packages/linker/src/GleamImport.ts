import { dlog } from "berry-pretty";
import {
  kind,
  makeEolf,
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
  withSepPlus,
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

const eolf = makeEolf(gleamImportTokens, gleamImportTokens.ws);
const wordToken = kind(gleamImportTokens.word);

// forward reference (for mutual recursion)
let pathTail: Parser<any, NoTags> = null as any; // TODO fix parser type
let packagePath: Parser<any, NoTags> = null as any; // TODO fix parser type

const simpleSegment = wordToken.map((r) => {
  return new SimpleSegment(r.value);
});

const itemImport = withTags(
  seq(
    wordToken.tag("segment"),
    skipWs(opt(seq("as", wordToken.tag("as"))))
  ).map((r) => {
    const segment = r.tags.segment[0];
    return new SimpleSegment(segment, r.tags.as?.[0]);
  })
);

const starImport = seq(
  skipWs(seq("*", opt(seq("as", wordToken.tag("as")))))
).map((r) => new Wildcard(r.tags.as?.[0]));

const collectionItem = or(
  seq(() => packagePath),
  itemImport
);

const importCollection = withTags(
  seq(
    "{",
    skipWs(
      seq(
        withSepPlus(",", () => collectionItem).tag("list"),
        "}" //
      ) 
    )
  ).map((r) => {
    const elems = r.tags.list.flat();
    return new SegmentList(elems as any); // TODO fix types
  })
);

const pathSegment = or(simpleSegment, importCollection);

const pathExtends = withTags(
  seq(simpleSegment.tag("s"), "/", () => pathTail.tag("s")).map((r) => r.tags.s)
);

/** The tail covers the part of the import path after the prefix */
pathTail = withTags(
  or(pathExtends, importCollection, itemImport, starImport).map((r) => {
    const tailSegments = r.value;
    // dlog({ tailSegments });
    return tailSegments;
  })
);

// The prefix covers the import path until the point we could import an item
// so ../foo or foo/

const relativePrefix = withTags(
  seq(
    repeatPlus(seq(or(".", "..").tag("seg"), "/")),
    simpleSegment.tag("seg"),
    "/"
  ).map((r) => r.tags.seg.map((r) => new SimpleSegment(r)))
);

const relativePath = withTags(
  seq(relativePrefix.tag("seg"), pathTail.tag("seg")).map((r) =>
    r.tags.seg.flat()
  )
);
const packagePrefix = withTags(
  seq(wordToken.tag("pkg"), "/").map((r) => new SimpleSegment(r.tags.pkg[0]))
);

packagePath = withTags(
  seq(packagePrefix, pathTail.tag("seg")).map((r) => r.tags.seg.flat())
);

const fullPath = noSkipWs(
  seq(kind(gleamImportTokens.ws), or(relativePath, packagePath).tag("path"))
).map((r) => {
  return new ImportTree(r.tags.path.flat());
});

/** parse a Gleam style wgsl import statement. */
export const gleamImport = withTags(
  tokens(
    gleamImportTokens,
    seq("import", fullPath.tag("imports"), opt(";"), eolf).map((r) => {
      const e = makeElem("treeImport", r, ["imports"]) as TreeImportElem;
      r.app.state.push(e);
    })
  )
).trace();
// );

if (tracing) {
  const names: Record<string, Parser<unknown, TagRecord>> = {
    simpleSegment,
    itemImport,
    starImport,
    importCollection,
    pathSegment,
    pathExtends,
    pathTail,
    relativePrefix,
    relativePath,
    packagePrefix,
    packagePath,
    fullPath,
    gleamImport,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
