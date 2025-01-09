import {
  anyThrough,
  kind,
  opt,
  or,
  repeat,
  req,
  seq,
  setTraceNames,
  tokens,
  tracing,
} from "mini-parse";
import { gleamImport } from "./GleamImport.js";
import { argsTokens, lineCommentTokens, mainTokens } from "./MatchWgslD.js";
import { eolf } from "./ParseSupport.js";

/* parse #directive enhancements to wgsl: #export, etc. */

const argsWord = kind(argsTokens.arg);
const fromWord = or(argsWord, kind(argsTokens.relPath));

const fromClause = seq("from", or(fromWord, seq('"', fromWord, '"')));

/** #export <foo> <(a,b)> EOL */
export const exportDirective = seq(or("#export", "export"), opt(eolf));

export const directive = tokens(
  argsTokens,
  seq(repeat("\n"), or(exportDirective, gleamImport)),
);

const skipToEol = tokens(lineCommentTokens, anyThrough(eolf));

/** parse a line comment */
export const lineComment = seq(tokens(mainTokens, "//"), skipToEol);

if (tracing) {
  setTraceNames({
    fromClause,
    exportDirective,
    skipToEol,
    lineComment,
    directive,
  });
}
