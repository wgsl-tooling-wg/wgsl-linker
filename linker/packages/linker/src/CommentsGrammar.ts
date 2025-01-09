import {
  any,
  anyNot,
  anyThrough,
  disablePreParse,
  makeEolf,
  or,
  Parser,
  repeat,
  req,
  resultLog,
  seq,
  tokens,
} from "mini-parse";
import { argsTokens, lineCommentTokens, mainTokens } from "./WESLTokens.ts";

/* Basic parsing functions for comment handling . */

/** currently unused */
export const unknown = any().map(r => {
  const { kind, text } = r.value;
  const deepName = r.ctx._debugNames.join(" > ");

  resultLog(r, `??? ${kind}: '${text}'  ${deepName}`);
  // throw new Error("Fail fast");
});

const eolf: Parser<any> = disablePreParse(
  makeEolf(argsTokens, argsTokens.ws),
);

const skipToEol = tokens(lineCommentTokens, anyThrough(eolf));

export const blockComment: Parser<any> = seq(
  "/*",
  repeat(or(() => blockComment, anyNot("*/"))),
  req("*/"),
);

export const lineComment = seq(tokens(mainTokens, "//"), skipToEol);

export const comment = or(() => lineComment, blockComment).trace({
  hide: true,
});
