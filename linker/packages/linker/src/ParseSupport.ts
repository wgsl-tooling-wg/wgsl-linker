import {
  any,
  anyNot,
  anyThrough,
  disablePreParse,
  ExtendedResult,
  kind,
  makeEolf,
  or,
  Parser,
  repeat,
  req,
  resultLog,
  seq,
  setTraceName,
  tokens,
  tracing,
} from "mini-parse";
import { argsTokens, lineCommentTokens, mainTokens } from "./WESLTokens.ts";

/* Basic parsing functions for comment handling, eol, etc. */

export const word = or(
  kind(mainTokens.ident),
  kind(mainTokens.textureStorage),
);

export const unknown = any().map(r => {
  const { kind, text } = r.value;
  const deepName = r.ctx._debugNames.join(" > ");

  resultLog(r, `??? ${kind}: '${text}'  ${deepName}`);
  // throw new Error("Fail fast");
});

export const blockComment: Parser<any> = seq(
  "/*",
  repeat(or(() => blockComment, anyNot("*/"))),
  req("*/"),
);

export const eolf: Parser<any> = disablePreParse(
  makeEolf(argsTokens, argsTokens.ws),
);

const skipToEol = tokens(lineCommentTokens, anyThrough(eolf));

/** parse a line comment */
export const lineComment = seq(tokens(mainTokens, "//"), skipToEol);

export const comment = or(() => lineComment, blockComment).trace({
  hide: true,
});

