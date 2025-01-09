import {
  anyThrough,
  kind,
  or,
  repeat,
  seq,
  setTraceNames,
  tokens,
  tracing
} from "mini-parse";
import { gleamImport } from "./ImportGrammar.js";
import { eolf } from "./ParseSupport.js";
import { argsTokens, lineCommentTokens, mainTokens } from "./WESLTokens.js";

/* parse #directive enhancements to wgsl: #export, etc. */

const argsWord = kind(argsTokens.arg);
const fromWord = or(argsWord, kind(argsTokens.relPath));

const fromClause = seq("from", or(fromWord, seq('"', fromWord, '"')));

export const directive = tokens(
  argsTokens,
  seq(repeat("\n"), or(gleamImport)),
);

const skipToEol = tokens(lineCommentTokens, anyThrough(eolf));

/** parse a line comment */
export const lineComment = seq(tokens(mainTokens, "//"), skipToEol);

if (tracing) {
  setTraceNames({
    fromClause,
    skipToEol,
    lineComment,
    directive,
  });
}
