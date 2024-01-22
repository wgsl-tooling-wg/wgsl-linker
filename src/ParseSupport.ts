import { argsTokens } from "./MatchWgslD.js";
import { lineCommentOptDirective } from "./ParseDirective.js";
import { Parser } from "./Parser.js";
import {
  CombinatorArg,
  any,
  anyNot,
  eof,
  fn,
  kind,
  not,
  opt,
  or,
  repeat,
  seq,
  tokens,
  withSep,
} from "./ParserCombinator.js";
import { logErr } from "./TraverseRefs.js";

/* Basic parsing functions for comment handling, eol, etc. */

// prettier-ignore
export const eolf = seq(
  opt(kind(argsTokens.ws)), 
  or("\n", eof())
).tokenIgnore().traceName("eolf");

export const unknown = any().map((r) => logErr("???", r.value, r.start));

export const skipBlockComment: Parser<any> = seq(
  "/*",
  repeat(
    or(
      fn(() => skipBlockComment),
      anyNot("*/")
    )
  ),
  "*/"
).traceName("skipBlockComment");

export const comment = or(
  fn(() => lineCommentOptDirective),
  skipBlockComment
).traceName("comment");

// prettier-ignore
/** ( <a> <,b>* )  with optional comments interspersed, does not span lines */
export const wordArgsLine: Parser<string[]> = tokens(
  argsTokens,
  seq(
    "(", 
    withSep(",", kind(argsTokens.word)), 
    ")"
  )
)
  .map((r) => r.value[1])
  .traceName("wordArgs");

const wordNum = or(kind(argsTokens.word), kind(argsTokens.digits));

/** ( a1, b1* ) with optinal comments, spans lines */
export const wordNumArgs: Parser<string[]> = seq(
  "(",
  withSep(",", wordNum),
  ")"
)
  .map((r) => r.value[1])
  .traceName("wordNumArgs");
