import {
  disablePreParse,
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
  tagScope,
  tokenMatcher,
  tokens,
  tokenSkipSet,
  tracing,
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
import { digits, eol, word } from "./MatchWgslD.js";
import { makeElem } from "./ParseSupport.js";
import { importElem, importList, importSegment } from "./WESLCollect.js";

const gleamImportSymbolSet = "/ { } , ( ) .. . * ; @ #"; // Had to add @ and # here to get the parsing tests to work. Weird.
const gleamImportSymbol = matchOneOf(gleamImportSymbolSet);

const skipWsSet = new Set(["ws"]);
function skipWs<V, T extends TagRecord>(p: Parser<V, T>): Parser<V, T> {
  return tokenSkipSet(skipWsSet, p);
}
function noSkipWs<V, T extends TagRecord>(p: Parser<V, T>): Parser<V, T> {
  return tokenSkipSet(null, p);
}
const ws = /\s+/;

export const gleamImportTokens = tokenMatcher({
  ws,
  gleamImportSymbol,
  word,
  digits,
});

export const packageTokens = tokenMatcher({
  ws,
  pkg: /[a-zA-Z_][\w-]*/, // LATER follow spec
  other: /.+/,
});

export const eolTokens = tokenMatcher({
  ws: /[ \t]+/, // don't include \n, for eolf
  eol,
});

const eolf = disablePreParse(
  makeEolf(eolTokens, gleamImportTokens.ws).traceName("gleam_eolf"),
);
const wordToken = kind(gleamImportTokens.word);
const pkgToken = kind(packageTokens.pkg);

// forward references for mutual recursion
let pathTail: Parser<PathSegment[], NoTags> = null as any;
let packagePath: Parser<PathSegment[], NoTags> = null as any;

const simpleSegment = tagScope(
  wordToken
    .ptag("segment")
    .collect(importSegment)
    .map(r => {
      return new SimpleSegment(r.value);
    }),
);

const itemImport = tagScope(
  withTags(
    seq(
      wordToken.tag("segment").ptag("segment"),
      skipWs(opt(seq("as", wordToken.ptag("as").tag("as")))),
    )
      .collect(importSegment)
      .map(r => {
        const segment = r.tags.segment[0];
        return new SimpleSegment(segment, r.tags.as?.[0]);
      }),
  ),
);

const starImport = seq(
  skipWs(seq("*", opt(seq("as", wordToken.tag("as"))))),
).map(r => new Wildcard(r.tags.as?.[0]));

const collectionItem = or(
  () => packagePath,
  itemImport.map(r => [r.value]),
);

const importCollection = tagScope(
  withTags(
    seq(
      "{",
      skipWs(
        seq(
          withSepPlus(",", () => collectionItem)
            .ptag("list")
            .tag("list"),
          "}", //
        ),
      ),
    )
      .collect(importList)
      .map(r => {
        const elems = r.tags.list.flat().map(l => new ImportTree(l));
        return new SegmentList(elems);
      }),
  ),
);

const pathExtends = withTags(
  seq(simpleSegment.tag("s"), "/", () => pathTail.tag("s")).map(r =>
    r.tags.s.flat(),
  ),
);

/** The tail covers the part of the import path after the prefix */
pathTail = withTags(
  or(
    pathExtends,
    or(importCollection, itemImport, starImport).map(r => [r.value]),
  ).map(r => {
    return r.value.flat();
  }),
).ctag("seg");

const relativeSegment = tagScope(
  withTags(
    seq(or(".", "..").ptag("segment").tag("dir"), "/")
      .collect(importSegment)
      .map(r => new SimpleSegment(r.tags.dir[0])),
  ),
);

// The prefix covers the import path until the last item
const relativePrefix = seq(
  repeatPlus(relativeSegment.ctag("seg").tag("seg")),
  simpleSegment.ctag("seg").tag("seg"),
  "/",
).map(r => {
  return r.tags.seg;
});

const relativePath = withTags(
  seq(relativePrefix.tag("p"), pathTail.tag("p")).map(r => r.tags.p.flat()),
);

const packagePrefix = withTags(
  seq(tokens(packageTokens, pkgToken.tag("pkg")), "/").map(r => [
    new SimpleSegment(r.tags.pkg[0]),
  ]),
);

packagePath = seq(packagePrefix, pathTail).map(r => r.value.flat());

const fullPath = noSkipWs(
  seq(kind(gleamImportTokens.ws), or(relativePath, packagePath).tag("path")),
).map(r => {
  return new ImportTree(r.tags.path.flat());
});

/** parse a Gleam style wgsl import statement. */
export const gleamImport = tagScope(
  withTags(
    tokens(
      gleamImportTokens,
      seq("import", fullPath.tag("imports"), opt(";"), eolf)
        .collect(importElem())
        .map(r => {
          const e = makeElem("treeImport", r, ["imports"]) as TreeImportElem;
          r.app.stable.elems.push(e);
        }),
    ),
  ),
);

if (tracing) {
  const names: Record<string, Parser<unknown, TagRecord>> = {
    simpleSegment,
    itemImport,
    starImport,
    importCollection,
    pathExtends,
    pathTail,
    relativeSegment,
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
