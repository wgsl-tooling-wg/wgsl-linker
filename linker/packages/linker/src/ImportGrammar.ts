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
import {
  importElem,
  importList,
  importSegment,
  importTree,
} from "./WESLCollect.js";
import { digits, eol, ident } from "./WESLTokens.js";

// TODO now that ';' is required, special ws and eol handling is probably not needed.
const skipWsSet = new Set(["ws"]);
function skipWs<V, T extends TagRecord>(p: Parser<V, T>): Parser<V, T> {
  return tokenSkipSet(skipWsSet, p);
}
function noSkipWs<V, T extends TagRecord>(p: Parser<V, T>): Parser<V, T> {
  return tokenSkipSet(null, p);
}

const importSymbolSet = "/ { } , ( ) .. . * ; @ #"; // Had to add @ and # here to get the parsing tests to work. Weird.
const importSymbol = matchOneOf(importSymbolSet);

// TODO reconsider whether we need a separate token set for import statements vs wgsl/wesl
export const importTokens = tokenMatcher({
  ws: /\s+/,
  importSymbol,
  ident, // TODO allow '-' in pkg names?
  digits,
});

export const eolTokens = tokenMatcher({
  ws: /[ \t]+/, // don't include \n, for eolf
  eol,
});

const eolf = disablePreParse(makeEolf(eolTokens, importTokens.ws));
const wordToken = kind(importTokens.ident);

// forward references for mutual recursion
let packagePath: Parser<any, NoTags> = null as any;

// prettier-ignore
const simpleSegment = tagScope(
  wordToken                             .ptag("segment").collect(importSegment),
);

// prettier-ignore
/** last simple segment is allowed to have an 'as' rename */
const lastSimpleSegment = tagScope(
  seq(
    wordToken                           .ptag("segment"),
    skipWs(opt(seq("as", wordToken      .ptag("as")))),
  )                                     .collect(importSegment),
);

/** an item an a collection list {a, b} */
// prettier-ignore
const collectionItem = or(
  tagScope(or(() => packagePath)        .collect(importTree)),
  lastSimpleSegment,
);

// prettier-ignore
const importCollection = tagScope(
  seq(
    "{",
    skipWs(
      seq(
        withSepPlus(",", () => collectionItem     .ctag("list")),
        "}",
      ),
    ),
  ).collect(importList),
);

/** a relative path element like "./" or "../" */
// prettier-ignore
const relativeSegment = tagScope(
  seq(
    or(".", "..")                   .ptag("segment"), 
    "/"
  )                                 .collect(importSegment),
)                                   .ctag("p");

const lastSegment = or(lastSimpleSegment, importCollection);

// prettier-ignore
const packageTail = seq(
  repeat(
    seq(
      simpleSegment                 .ctag("p"), 
      "/"
    )
  ),
  lastSegment                       .ctag("p"),
);

/** a module path starting with ../ or ./ */
const relativePath = seq(repeatPlus(relativeSegment), packageTail);

// prettier-ignore
const packagePrefix = tagScope(
  seq(
    wordToken                     .ptag("segment"), 
    "/"
  )                               .collect(importSegment),
)                                 .ctag("p");

/** a module path, starting with a simple element */
packagePath = seq(packagePrefix, packageTail);

const fullPath = noSkipWs(
  seq(kind(importTokens.ws), or(relativePath, packagePath)),
);

/** parse a WESL style wgsl import statement. */
// prettier-ignore
export const weslImport = tagScope(
  tokens(
    importTokens,
    seq("import", fullPath, opt(";"), eolf)     .collect(importElem()),
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
    weslImport,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
