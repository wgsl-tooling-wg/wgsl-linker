import {
  anyThrough,
  kind,
  opt,
  or,
  Parser,
  repeat,
  req,
  seq,
  setTraceNames,
  tokens,
  tracing,
  withSep,
} from "mini-parse";
import { gleamImport } from "./GleamImport.js";
import { ImportTree, SimpleSegment } from "./ImportTree.js";
import {
  argsTokens,
  lineCommentTokens,
  mainTokens,
  moduleTokens,
} from "./MatchWgslD.js";
import { eolf, makeElem } from "./ParseSupport.js";

/* parse #directive enhancements to wgsl: #import, #export, etc. */

const argsWord = kind(argsTokens.arg);
const fromWord = or(argsWord, kind(argsTokens.relPath));

// prettier-ignore
/** ( <a> <,b>* ) */
export const directiveArgs: Parser<string[]> = 
  seq(
    "(", 
    withSep(",", argsWord), 
    req(")")
  ).map((r) => r.value[1]);

const fromClause = seq(
  "from",
  or(fromWord.tag("from"), seq('"', fromWord.tag("from"), '"')),
);

export interface ImportClause {
  name: string;
  as?: string;
  args?: string[];
}

// prettier-ignore
/** foo <(A,B)> <as bar> */
const importClause = seq(
  argsWord.tag("name"),
  opt(directiveArgs.tag("args")),
  opt(seq("as", argsWord.tag("as")))
).map(r =>
  ({ name: r.tags.name[0],
    as: r.tags.as?.[0],
    args: r.tags.args?.[0],
  }) as ImportClause
).tag("importClause");

const importList = withSep(",", importClause, { requireOne: true });

// prettier-ignore
const bracketedImportClause = or(
  importList, 
  seq("{", importList, "}")
);

const importElemPhrase = seq(bracketedImportClause, fromClause).map(r => {
  const from = r.tags.from?.[0];
  return r.tags.importClause.map(impClause => {
    const elem = makeElem("treeImport", r as any, [], []);
    const fromSegments = from.split("/").map(s => new SimpleSegment(s));
    const lastSegment = new SimpleSegment(
      impClause.name,
      impClause.as,
      impClause.args,
    );
    const segments = [...fromSegments, lastSegment];
    const importTree: ImportTree = new ImportTree(segments);
    elem.imports = importTree;
    // TODO wildcards
    return elem;
  });
});

if (tracing) setTraceNames({ importElemPhrase });

/** #import foo <(a,b)> <as boo> <from bar>  EOL */
const importDirective = seq(
  or("#import", "import"),
  seq(importElemPhrase.tag("imp"), opt(";"), () => eolf),
).map(r => {
  r.tags.imp[0].forEach(imp => {
    imp.start = r.start; // use start of #import, not import phrase
    r.app.state.push(imp);
  });
});


export const importing = seq(
  "importing",
  seq(importElemPhrase.tag("importing")),
  repeat(seq(",", importElemPhrase.tag("importing"))),
);

/** #export <foo> <(a,b)> <importing bar(a) <zap(b)>* > EOL */
export const exportDirective = seq(
  or("#export", "export"),
  seq(opt(directiveArgs.tag("args")), opt(importing), opt(eolf)),
).map(r => {
  const e = makeElem("export", r, ["args", "importing"]);
  r.app.state.push(e);
});

const moduleDirective = seq(
  or("module", "#module"),
  tokens(moduleTokens, req(kind(moduleTokens.moduleName).tag("name"))),
  eolf,
).map(r => {
  const e = makeElem("module", r);
  e.name = normalizeModulePath(r.tags.name[0]);
  r.app.state.push(e);
});

function normalizeModulePath(name: string): string {
  if (name.includes("::")) {
    const result = name.split("::").join("/");
    return result;
  }
  return name;
}

export const directive = tokens(
  argsTokens,
  seq(
    repeat("\n"),
    or(
      exportDirective,
      importDirective,
      gleamImport,
      moduleDirective,
    ),
  ),
);

const skipToEol = tokens(lineCommentTokens, anyThrough(eolf));

/** parse a line comment */
export const lineComment = seq(tokens(mainTokens, "//"), skipToEol);

if (tracing) {
  setTraceNames({
    directiveArgs,
    fromClause,
    importClause,
    importList,
    bracketedImportClause,
    importElemPhrase,
    importing,
    importDirective,
    exportDirective,
    skipToEol,
    lineComment,
    moduleDirective,
    directive,
  });
}

function copyDefinedProps<S extends Record<string, any>>(
  src: S,
  keys: (keyof S)[],
  dest: any,
): void {
  keys.forEach(k => {
    if (src[k] !== undefined) dest[k] = src[k];
  });
}
