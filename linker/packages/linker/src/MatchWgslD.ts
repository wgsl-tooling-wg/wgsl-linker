import { matchOneOf, tokenMatcher } from "mini-parse";

// https://www.w3.org/TR/WGSL/#blankspace-and-line-breaks
/** New lines */
export const eol = /[\n\v\f\u{0085}\u{2028}\u{2029}]|\r\n?/u;
/** Whitespaces including new lines */
export const blankspaces =
  /[ \t\n\v\f\r\u{0085}\u{200E}\u{200F}\u{2028}\u{2029}]+/u;

export const directive = /#[a-zA-Z_]\w*/;

const symbolSet =
  "& && -> @ / ! [ ] { } :: : , == = != >>= >> >= > <<= << <= < % - --" +
  " . + ++ | || ( ) ; * ~ ^ // /* */ += -= *= /= %= &= |= ^=" +
  // For the _ = expr; syntax
  " _";

const symbol = matchOneOf(symbolSet);
const quote = /["']/;

export const word =
  /(?:(?:[_\p{XID_Start}][\p{XID_Continue}]+)|(?:[\p{XID_Start}]))/u;

export const digits = new RegExp(
  // decimal_float_literal
  /(?:0[fh])|(?:[1-9][0-9]*[fh])/.source +
    /|(?:[0-9]*\.[0-9]+(?:[eE][+-]?[0-9]+)?[fh]?)/.source +
    /|(?:[0-9]+\.[0-9]*(?:[eE][+-]?[0-9]+)?[fh]?)/.source +
    /|(?:[0-9]+[eE][+-]?[0-9]+[fh]?)/.source +
    // hex_float_literal
    /|(?:0[xX][0-9a-fA-F]*\.[0-9a-fA-F]+(?:[pP][+-]?[0-9]+[fh]?)?)/.source +
    /|(?:0[xX][0-9a-fA-F]+\.[0-9a-fA-F]*(?:[pP][+-]?[0-9]+[fh]?)?)/.source +
    /|(?:0[xX][0-9a-fA-F]+[pP][+-]?[0-9]+[fh]?)/.source +
    // hex_int_literal
    /|(?:0[xX][0-9a-fA-F]+[iu]?)/.source +
    // decimal_int_literal
    /|(?:0[iu]?)|(?:[1-9][0-9]*[iu]?)/.source,
);

/** matching tokens at wgsl root level */
export const mainTokens = tokenMatcher(
  {
    directive,
    word,
    digits,
    symbol,
    quote,
    ws: blankspaces,
  },
  "main",
);

export const bracketTokens = tokenMatcher(
  {
    bracket: /<|>/,
    ws: blankspaces,
    other: /[^<>]+/,
  },
  "bracket",
);

export const identTokens = tokenMatcher(
  {
    ws: blankspaces,
    symbol,
    digits,
    quote,
  },
  "longIdent",
);

export const moduleTokens = tokenMatcher(
  {
    ws: blankspaces,
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
    ws: blankspaces,
    importSymbol,
    word,
    digits,
  },
  "treeTokens",
);

export const rootWs = tokenMatcher(
  {
    blanks: /\s+/,
    other: /[^\s]+/,
  },
  "rootWs",
);
