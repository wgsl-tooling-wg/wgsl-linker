import {
  kind,
  NoTags,
  opt,
  or,
  Parser,
  repeatPlus,
  seq,
  setTraceName,
  TagRecord,
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
import { mainTokens } from "./MatchWgslD.js";
import { makeElem } from "./ParseSupport.js";

const wordToken = kind(mainTokens.word);

// forward references (for mutual recursion)
let pathTail: Parser<PathSegment[], NoTags> = null as any;
let packagePath: Parser<PathSegment[], NoTags> = null as any;

const simpleSegment = wordToken.map(r => {
  return new SimpleSegment(r.value);
});

const itemImport = withTags(
  seq(wordToken.tag("segment"), opt(seq("as", wordToken.tag("as")))).map(r => {
    const segment = r.tags.segment[0];
    return new SimpleSegment(segment, r.tags.as?.[0]);
  }),
);

const starImport = seq(seq("*", opt(seq("as", wordToken.tag("as"))))).map(
  r => new Wildcard(r.tags.as?.[0]),
);

const collectionItem = or(
  () => packagePath,
  itemImport.map(r => [r.value]),
);

const importCollection = withTags(
  seq(
    "{",
    seq(
      withSepPlus(",", () => collectionItem).tag("list"),
      "}", //
    ),
  ).map(r => {
    const elems = r.tags.list.flat().map(l => new ImportTree(l));
    return new SegmentList(elems);
  }),
);

const pathSegment = or(simpleSegment, importCollection);

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
);

// The prefix covers the import path until the point we could import an item
// so ../foo or foo/

const relativeSegment = withTags(
  seq(
    or(
      seq(".", ".").map(() => ".."),
      ".",
    ).tag("dir"),
    "/",
  ).map(r => new SimpleSegment(r.tags.dir[0])),
);

const relativePrefix = withTags(
  seq(
    repeatPlus(relativeSegment.tag("seg")),
    simpleSegment.tag("seg"),
    "/",
  ).map(r => {
    return r.tags.seg;
  }),
);

const relativePath = withTags(
  seq(relativePrefix.tag("p"), pathTail.tag("p")).map(r => r.tags.p.flat()),
);

const packagePrefix = withTags(
  seq(wordToken.tag("pkg"), "/").map(r => [new SimpleSegment(r.tags.pkg[0])]),
);

packagePath = seq(packagePrefix, pathTail).map(r => r.value.flat());

const fullPath = or(relativePath, packagePath)
  .tag("path")
  .map(r => {
    return new ImportTree(r.tags.path.flat());
  });

/** parse a Gleam style wgsl import statement. */
export const gleamImport = withTags(
  seq("import", fullPath.tag("imports"), opt(";")).map(r => {
    const e = makeElem("treeImport", r, ["imports"]) as TreeImportElem;
    r.app.state.push(e);
  }),
);

if (tracing) {
  const names: Record<string, Parser<unknown, TagRecord>> = {
    simpleSegment,
    itemImport,
    starImport,
    importCollection,
    pathSegment,
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
