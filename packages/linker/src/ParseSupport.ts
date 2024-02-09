import { AbstractElem } from "./AbstractElems.js";
import { resultLog } from "./LinkerLogging.js";
import { argsTokens, mainTokens } from "./MatchWgslD.js";
import { lineCommentOptDirective } from "./ParseDirective.js";
import { ExtendedResult, Parser, setTraceName } from "../../mini-parse/src/Parser.js";
import {
  any,
  anyNot,
  fn,
  kind,
  makeEolf,
  or,
  repeat,
  req,
  seq,
  withSep,
} from "../../mini-parse/src/ParserCombinator.js";
import { tracing } from "../../mini-parse/src/ParserTracing.js";

/* Basic parsing functions for comment handling, eol, etc. */

export const word = kind(mainTokens.word);
export const wordNum = or(word, kind(mainTokens.digits));

export const unknown = any().map((r) => {
  const { kind, text } = r.value;
  resultLog(r, `??? ${kind}: '${text}'`);
});

export const skipBlockComment: Parser<any> = seq(
  "/*",
  repeat(
    or(
      fn(() => skipBlockComment),
      anyNot("*/")
    )
  ),
  req("*/")
);

export const comment = or(
  fn(() => lineCommentOptDirective),
  skipBlockComment
);

export const eolf: Parser<any> = makeEolf(argsTokens, argsTokens.ws)
  .disablePreParse();

/** ( a1, b1* ) with optinal comments, spans lines */
export const wordNumArgs: Parser<string[]> = seq(
  "(",
  withSep(",", wordNum),
  req(")")
).map((r) => r.value[1]);

/** create an AbstractElem from parse results
 * @param named keys in the named result to copy to
 *  like named fields in the abstract elem (as a single value)
 * @param namedArray keys in the named result to copy to
 *  like named fields in the abstract elem (as an array)
 */
export function makeElem<U extends AbstractElem>(
  kind: U["kind"],
  er: ExtendedResult<any>,
  named: (keyof U)[] = [],
  namedArrays: (keyof U)[] = []
): U {
  const { start, end } = er;
  const nv = mapIfDefined(named, er.named as NameRecord<U>, true);
  const av = mapIfDefined(namedArrays, er.named as NameRecord<U>);
  return { kind, start, end, ...nv, ...av } as U;
}

type NameRecord<A> = Record<keyof A, string[]>;

function mapIfDefined<A>(
  keys: (keyof A)[],
  array: Record<keyof A, string[]>,
  firstElem?: boolean
): Partial<Record<keyof A, string>> {
  const entries = keys.flatMap((k) => {
    const ak = array[k];
    const v = firstElem ? ak?.[0] : ak;

    if (v === undefined) return [];
    else return [[k, v]];
  });
  return Object.fromEntries(entries);
}

// enableTracing();
if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    skipBlockComment,
    comment,
    wordNumArgs,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}