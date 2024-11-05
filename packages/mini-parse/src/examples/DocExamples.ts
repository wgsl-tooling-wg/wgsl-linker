import { kind, or, repeat, seq, tokens } from "../ParserCombinator.js";
import { matchOneOf, tokenMatcher } from "../TokenMatcher.js";

export const simpleTokens = tokenMatcher({
  number: /\d+/,
  symbol: matchOneOf("( ) ^ + - * /"),
  ws: /\s+/,
});

const num = kind(simpleTokens.number);

export const simpleSum = seq(num, or("+", "-"), num);

const int = num.map(r => parseInt(r.value));

export const sumResults = seq(int, or("+", "-"), int).map(r => {
  const [a, op, b] = r.value;
  return op === "+" ? a + b : a - b;
});

const op = or("+", "-");

export const taggedSum = seq(
  int,
  repeat(seq(op, int).tag("opRights")), // accumulate an array of [op, int] pairs
).map(r => {
  const { opRights } = r.tags;
  const left = r.value[0];
  if (!opRights) return left;
  return opRights.reduce((acc, opRight) => {
    const [op, right] = opRight;
    return op === "+" ? acc + right : acc - right;
  }, left);
});

const quoteTokens = tokenMatcher({
  quote: /"/,
  nonQuote: /[^"]+/,
});

const nonQuote = kind(quoteTokens.nonQuote);
const quote = seq('"', tokens(quoteTokens, repeat(nonQuote)), '"');

type ASTElem = BinOpElem;

interface BinOpElem {
  kind: "binOp";
  left: number | BinOpElem;
  right: number | BinOpElem;
  op: "+" | "-";
}

export const sumElem = seq(int, or("+", "-"), int).map(r => {
  const [a, op, b] = r.value;
  const binOpElem: BinOpElem = {
    kind: "binOp",
    left: a,
    right: b,
    op: op as "+" | "-",
  };
  r.app.state.push(binOpElem);
});
