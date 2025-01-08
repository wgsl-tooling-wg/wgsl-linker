import {
  disablePreParse,
  kind,
  makeEolf,
  matchOneOf,
  NoTags,
  opt,
  or,
  Parser,
  repeat,
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
} from "mini-parse";
import { digits, eol, ident } from "./MatchWgslD.js";
import {
  importElem,
  importList,
  importSegment,
  importTree,
} from "./WESLCollect.js";

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
  ident, // TODO allow '-' in pkg names?
  digits,
});

export const eolTokens = tokenMatcher({
  ws: /[ \t]+/, // don't include \n, for eolf
  eol,
});

const eolf = disablePreParse(makeEolf(eolTokens, gleamImportTokens.ws));
const wordToken = kind(gleamImportTokens.ident);

// forward references for mutual recursion
let packagePath: Parser<any, NoTags> = null as any;

const simpleSegment = tagScope(
  wordToken.ptag("segment").collect(importSegment),
);

/** last simple segment is allowed to have an 'as' rename */
const lastSimpleSegment = tagScope(
  seq(
    wordToken.ptag("segment"),
    skipWs(opt(seq("as", wordToken.ptag("as")))),
  ).collect(importSegment),
);

/** an item an a collection list {a, b} */
const collectionItem = or(
  tagScope(or(() => packagePath).collect(importTree)),
  lastSimpleSegment,
);

const importCollection = tagScope(
  seq(
    "{",
    skipWs(seq(withSepPlus(",", () => collectionItem.ctag("list")), "}")),
  ).collect(importList),
);

/** a relative path element like "./" or "../" */
const relativeSegment = tagScope(
  seq(or(".", "..").ptag("segment"), "/").collect(importSegment),
).ctag("p");

const lastSegment = or(lastSimpleSegment, importCollection);

const packageTail = seq(
  repeat(seq(simpleSegment.ctag("p"), "/")),
  lastSegment.ctag("p"),
);

/** a module path starting with ../ or ./ */
const relativePath = seq(repeatPlus(relativeSegment), packageTail);

const packagePrefix = tagScope(
  seq(wordToken.ptag("segment"), "/").collect(importSegment),
).ctag("p");

/** a module path, starting with a simple element */
packagePath = seq(packagePrefix, packageTail);

const fullPath = noSkipWs(
  seq(kind(gleamImportTokens.ws), or(relativePath, packagePath)),
);

/** parse a Gleam style wgsl import statement. */
export const gleamImport = tagScope(
  tokens(
    gleamImportTokens,
    seq("import", fullPath, opt(";"), eolf).collect(importElem()),
  ),
);

if (tracing) {
  const names: Record<string, Parser<unknown, TagRecord>> = {
    simpleSegment,
    lastSimpleSegment,
    importCollection,
    relativeSegment,
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
