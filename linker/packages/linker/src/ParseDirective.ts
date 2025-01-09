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
import { weslImport } from "./ImportGrammar.js";
import { eolf } from "./ParseSupport.js";
import { argsTokens, lineCommentTokens, mainTokens } from "./WESLTokens.js";

export const directive = tokens(
  argsTokens,
  seq(repeat("\n"), or(weslImport)),
);

const skipToEol = tokens(lineCommentTokens, anyThrough(eolf));

/** parse a line comment */
export const lineComment = seq(tokens(mainTokens, "//"), skipToEol);

if (tracing) {
  setTraceNames({
    skipToEol,
    lineComment,
    directive,
  });
}
