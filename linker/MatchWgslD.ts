import { matchOneOf, tokenMatcher } from "@wesl/mini-parse";

/** token matchers for wgsl with #directives */

export const eol = /\n|\r\n/;
export const directive = /#[a-zA-Z_]\w*/;
export const notDirective = /[^#\n]+/;

const symbolSet =
  "& && -> @ / ! [ ] { } : , = == != > >= < << <= % - -- " + // '>>' elided for template parsing, e.g. vec2<vec2<u8>>
  ". + ++ | || ( ) ; * ~ ^ // /* */ += -= *= /= %= &= |= ^= >>= <<= <<";
const symbol = matchOneOf(symbolSet);
const quote = /["']/;

const longIdent = /[a-zA-Z_][\w.:]*/; // identifier that can include module path
export const word = /[a-zA-Z_]\w*/; // LATER consider making this 'ident' per wgsl spec (incl. non-ascii)
export const digits = /(?:0x)?[\d.]+[iuf]?/; // LATER parse more wgsl number variants

/** matching tokens at wgsl root level */
export const mainTokens = tokenMatcher(
  {
    directive,
    attr: /@[a-zA-Z_]\w*/,
    word,
    digits,
    symbol,
    quote,
    ws: /\s+/,
  },
  "main",
);

export const identTokens = tokenMatcher(
  {
    longIdent,
    ws: /\s+/,
    symbol,
    digits,
    quote,
  },
  "longIdent",
);

export const moduleTokens = tokenMatcher(
  {
    ws: /\s+/,
    moduleName: /[a-zA-Z_][\w./:-]*/,
  },
  "moduleName",
);

/** matching tokens at the start of a '//' line comment that might contain #directives */
export const lineCommentTokens = tokenMatcher(
  {
    ws: /[ \t]+/, // note ws must be before notEol
    notEol: /[^\n]+/,
    eol,
  },
  "lineComment",
);

/** matching tokens while parsing directive parameters #export foo(param1, param2) */
export const argsTokens = tokenMatcher(
  {
    directive,
    quote,
    relPath: /[.][/\w._-]+/,
    arg: /[\w._-]+/,
    symbol,
    ws: /[ \t]+/, // don't include \n, so we can find eol separately
    eol,
  },
  "argsTokens",
);

const treeImportSymbolSet = ":: { } , ( ) _ . ; *";
const importSymbol = matchOneOf(treeImportSymbolSet);

export const treeImportTokens = tokenMatcher(
  {
    directive,
    quote,
    ws: /\s+/,
    importSymbol,
    word,
    digits,
  },
  "treeTokens"
);

export const rootWs = tokenMatcher(
  {
    blanks: /\s+/,
    other: /[^\s]+/,
  },
  "rootWs"
);
