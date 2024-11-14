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
  withSep,
} from "@wesl/mini-parse";
import type { AbstractElem, AbstractElemBase } from "./AbstractElems.ts";
import { argsTokens, lineCommentTokens, mainTokens } from "./MatchWgslD.ts";

/* Basic parsing functions for comment handling, eol, etc. */

export const word = kind(mainTokens.word);
export const literal = or("true", "false", kind(mainTokens.digits));
/** WGSL combined tokens consist of individual tokens, one after another. */
export const op = (tokens: string) => seq(...tokens.split(""));

export const unknown = any().map((r) => {
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

export const comment = or(() => lineComment, blockComment);
// .trace({
//   hide: true,
// });

type ByKind<U, T> = U extends { kind: T } ? U : never;

type TagsType<U extends AbstractElem> = Record<
  Exclude<keyof U, keyof AbstractElemBase>,
  any[]
>;

/** create an AbstractElem from parse results
 * @param named keys in the tags result to copy to
 *  like named fields in the abstract elem (as a single value)
 * @param namedArray keys in the tags result to copy to
 *  like named fields in the abstract elem (as an array)
 */
export function makeElem<
  U extends AbstractElem,
  K extends U["kind"], // 'kind' of AbtractElem "fn"
  E extends ByKind<U, K>, // FnElem
  T extends TagsType<E>, // {name: string[]}
>(
  kind: K,
  er: ExtendedResult<any, Partial<T>>,
  tags: (keyof T)[] = [],
  tagArrays: (keyof T)[] = [],
): Partial<E> {
  const { start, end } = er;

  const nv = mapIfDefined(tags, er.tags, true);
  const av = mapIfDefined(tagArrays, er.tags);
  return { kind, start, end, ...nv, ...av } as Partial<E>;
}

function mapIfDefined<A>(
  keys: (keyof A)[],
  array: Partial<Record<keyof A, string[]>>,
  firstElemOnly?: boolean,
): Partial<Record<keyof A, string | string[]>> {
  const entries = keys.flatMap((k) => {
    const ak = array[k];
    const v = firstElemOnly ? ak?.[0] : ak;

    if (v === undefined) return [];
    else return [[k, v]];
  });
  return Object.fromEntries(entries);
}

if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    skipBlockComment: blockComment,
    comment,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
