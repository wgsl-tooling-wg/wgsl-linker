import {
  or,
  repeat,
  seq,
  setTraceNames,
  tokens,
  tracing
} from "mini-parse";
import { weslImport } from "./ImportGrammar.js";
import { argsTokens } from "./WESLTokens.js";

export const directive = tokens(
  argsTokens,
  seq(repeat("\n"), or(weslImport)),
);


if (tracing) {
  setTraceNames({
    directive,
  });
}
