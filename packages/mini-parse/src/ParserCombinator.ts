import { ctxLog } from "../../linker/src/LinkerLogging.js";
import { quotedText } from "./MatchingLexer.js";
import {
  ExtendedResult,
  OptParserResult,
  Parser,
  parser,
  ParserContext,
  ParserResult,
  runExtended,
  simpleParser,
} from "./Parser.js";
import { mergeNamed } from "./ParserUtil.js";
import { Token, TokenMatcher } from "./TokenMatcher.js";

/** Parsing Combinators
 *
 * The basic idea is that parsers are contructed heirarchically from other parsers.
 * Each parser is independently testable and reusable with combinators like or() and seq().
 *
 * Each parser is a function that recognizes tokens produced by a lexer
 * and returns a result.
 *  Returning null indicate failure. Tokens are not consumed on failure.
 *  Users can also use the .named() method to tag results from a stage. Named results
 *    propagate up to containing parsers for convenience in selecting results.
 *
 * Built in parsers and combinators are available:
 *  kind() recognizes tokens of a particular type.
 *  or(), seq(), opt(), map() and repeat() combine other stages.
 *
 * Users construct their own parsers by combining other parser stages
 * and typically use map() to report results. Results can be stored
 * in the array app[], which is provided by the user and available for
 * all user constructed parsers.
 */

export class ParseError extends Error {
  constructor(msg?: string) {
    super(msg);
  }
}

/** parser combinators like or() and seq() combine other stages (strings are converted to kind() parsers) */
export type CombinatorArg<T> = Parser<T> | string;

/** Parse for a particular kind of token,
 * @return the matching text */
export function kind(kindStr: string): Parser<string> {
  return simpleParser(
    `kind '${kindStr}'`,
    (state: ParserContext): string | null => {
      const next = state.lexer.next();
      return next?.kind === kindStr ? next.text : null;
    }
  );
}

/** Parse for a token containing a text value
 * @return the kind of token that matched */
export function text(value: string): Parser<string> {
  return simpleParser(
    `text ${quotedText(value)}'`,
    (state: ParserContext): string | null => {
      const next = state.lexer.next();
      return next?.text === value ? next.text : null;
    }
  );
}

/** Try parsing with one or more parsers,
 *  @return the first successful parse */
export function or<A = Token>(a: CombinatorArg<A>): Parser<A>;
export function or<A = Token, B = Token>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>
): Parser<A | B>;
export function or<A = Token, B = Token, C = Token>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>
): Parser<A | B | C>;
export function or<A = Token, B = Token, C = Token, D = Token>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>
): Parser<A | B | C | D>;
export function or<A = Token, B = Token, C = Token, D = Token, E = Token>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>,
  e: CombinatorArg<E>
): Parser<A | B | C | D | E>;
export function or<
  A = Token,
  B = Token,
  C = Token,
  D = Token,
  E = Token,
  F = Token,
>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>,
  e: CombinatorArg<E>,
  f: CombinatorArg<F>
): Parser<A | B | C | D | E | F>;
export function or<
  A = Token,
  B = Token,
  C = Token,
  D = Token,
  E = Token,
  F = Token,
  G = Token,
>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>,
  e: CombinatorArg<E>,
  f: CombinatorArg<F>,
  g: CombinatorArg<G>
): Parser<A | B | C | D | E | F | G>;
export function or<
  A = Token,
  B = Token,
  C = Token,
  D = Token,
  E = Token,
  F = Token,
  G = Token,
  H = Token,
>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>,
  e: CombinatorArg<E>,
  f: CombinatorArg<F>,
  g: CombinatorArg<G>,
  h: CombinatorArg<H>
): Parser<A | B | C | D | E | F | G | H>;
export function or(...stages: CombinatorArg<any>[]): Parser<any> {
  return parser("or", (state: ParserContext): ParserResult<any> | null => {
    for (const stage of stages) {
      const parser = parserArg(stage);
      const result = parser._run(state);
      if (result !== null) {
        return result;
      }
    }
    return null;
  });
}

/** Parse a sequence of parsers
 * @return an array of all parsed results, or null if any parser fails */
export function seq<A = Token>(a: CombinatorArg<A>): Parser<[A]>;
export function seq<A = Token, B = Token>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>
): Parser<[A, B]>;
export function seq<A = Token, B = Token, C = Token>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>
): Parser<[A, B, C]>;
export function seq<A = Token, B = Token, C = Token, D = Token>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>
): Parser<[A, B, C, D]>;
export function seq<A = Token, B = Token, C = Token, D = Token, E = Token>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>,
  e: CombinatorArg<E>
): Parser<[A, B, C, D, E]>;
export function seq<
  A = Token,
  B = Token,
  C = Token,
  D = Token,
  E = Token,
  F = Token,
>(
  a: CombinatorArg<A>,
  b: CombinatorArg<B>,
  c: CombinatorArg<C>,
  d: CombinatorArg<D>,
  e: CombinatorArg<E>,
  f: CombinatorArg<F>
): Parser<[A, B, C, D, E, F]>;
export function seq(...stages: CombinatorArg<any>[]): Parser<any[]>;
export function seq(...stages: CombinatorArg<any>[]): Parser<any[]> {
  return parser("seq", (ctx: ParserContext) => {
    const values = [];
    let namedResults = {};
    for (const stage of stages) {
      const parser = parserArg(stage);
      const result = parser._run(ctx);
      if (result === null) return null;

      namedResults = mergeNamed(namedResults, result.named);
      values.push(result.value);
    }
    return { value: values, named: namedResults };
  });
}

/** Try a parser.
 *
 * If the parse succeeds, return the result.
 * If the parser fails, return false and don't advance the input. Returning false
 * indicates a successful parse, so combinators like seq() will succeed.
 */
export function opt(stage: string): Parser<string | boolean>;
export function opt<T>(stage: Parser<T>): Parser<T | boolean>;
export function opt<T>(stage: CombinatorArg<T>): Parser<T | string | boolean> {
  return parser(
    "opt",
    (state: ParserContext): OptParserResult<T | string | boolean> => {
      const parser = parserArg(stage);
      const result = parser._run(state);
      return result || { value: false, named: {} };
    }
  );
}

/** return true if the provided parser _doesn't_ match
 * does not consume any tokens */
export function not<T>(stage: CombinatorArg<T>): Parser<true> {
  return parser("not", (state: ParserContext): OptParserResult<true> => {
    const pos = state.lexer.position();
    const result = parserArg(stage)._run(state);
    if (!result) {
      return { value: true, named: {} };
    }
    state.lexer.position(pos);
    return null;
  });
}

/** yield next token, any token */
export function any(): Parser<Token> {
  return simpleParser("any", (state: ParserContext): Token | null => {
    const next = state.lexer.next();
    return next || null;
  });
}

/** yield next token if the provided parser doesn't match */
export function anyNot<T>(arg: CombinatorArg<T>): Parser<Token> {
  return seq(not(arg), any())
    .map((r) => r.value[1])
    .traceName("anyNot");
}

/** match everything until a terminator (and the terminator too) */
export function anyThrough(arg: CombinatorArg<any>): Parser<any> {
  const p = parserArg(arg);
  return seq(repeat(anyNot(p)), p).traceName(`anyThrough ${p.debugName}`);
}

export function repeat(stage: string): Parser<string[]>;
export function repeat<T>(stage: Parser<T>): Parser<T[]>;
export function repeat<T>(stage: CombinatorArg<T>): Parser<(T | string)[]> {
  return parser("repeat", repeatWhileFilter(stage));
}

type ResultFilterFn<T> = (
  result: ExtendedResult<T | string>
) => boolean | undefined;

export function repeatWhile<T>(
  arg: CombinatorArg<T>,
  filterFn: ResultFilterFn<T>
): Parser<(T | string)[]> {
  return parser("repeatWhile", repeatWhileFilter(arg, filterFn));
}

function repeatWhileFilter<T>(
  arg: CombinatorArg<T>,
  filterFn: ResultFilterFn<T> = () => true
): (ctx: ParserContext) => OptParserResult<(T | string)[]> {
  return (ctx: ParserContext): OptParserResult<(T | string)[]> => {
    const values: (T | string)[] = [];
    let results = {};
    const p = parserArg(arg);
    for (;;) {
      const result = runExtended<T | string>(ctx, p);

      // continue acccumulating until we get a null or the filter tells us to stop
      if (result !== null && filterFn(result)) {
        values.push(result.value);
        results = mergeNamed(results, result.named);
      } else {
        // always return succcess
        return { value: values, named: results };
      }
    }
  };
}

/** A delayed parser definition, for making recursive parser definitions. */
export function fn<T>(fn: () => Parser<T>): Parser<T | string> {
  return parser("fn", (state: ParserContext): OptParserResult<T | string> => {
    const stage = parserArg(fn());
    return stage._run(state);
  });
}

/** yields true if parsing has reached the end of input */
export function eof(): Parser<true> {
  return simpleParser(
    "eof",
    (state: ParserContext) => state.lexer.eof() || null
  );
}

/** if parsing fails, log an error and abort parsing */
export function req<T>(
  arg: CombinatorArg<T>,
  msg?: string
): Parser<T | string> {
  return parser("req", (ctx: ParserContext): OptParserResult<T | string> => {
    const parser = parserArg(arg);
    const result = parser._run(ctx);
    if (result === null) {
      ctxLog(ctx, msg ?? `expected ${parser.debugName}`);
      throw new ParseError();
    }
    return result;
  });
}

/** match an optional series of elements separated by a delimiter (e.g. a comma) */
export function withSep<T>(sep: CombinatorArg<any>, p: Parser<T>): Parser<T[]> {
  const elem = Symbol("elem");
  return opt(seq(p.named(elem), repeat(seq(sep, p.named(elem)))))
    .map((r) => r.named[elem] as T[])
    .traceName("withSep");
}

// TODO make this use it's own tokenMatcher or regex
/** return a parser that matches end of line, or end of file,
 * optionally preceded by white space
 * @param ws should not match \n */
export function makeEolf(tokens: TokenMatcher, ws: string): Parser<any> {
  // prettier-ignore
  return seq(
    opt(kind(ws)), 
    or("\n", eof())
  ).tokens(tokens)
   .tokenIgnore() // disable automatic ws skipping so we can match it above
   .traceName("eolf");
}

/** convert naked string arguments into text() parsers */
export function parserArg<T>(
  arg: CombinatorArg<T>
): Parser<T> | Parser<string> {
  return typeof arg === "string" ? text(arg) : arg;
}