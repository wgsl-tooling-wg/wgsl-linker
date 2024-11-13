import { Parser, setTraceName } from "../Parser.ts";
import { fn, opt, or, repeat, seq } from "../ParserCombinator.ts";
import { tracing } from "../ParserTracing.ts";
import { mulDiv, num, plusMinus } from "./CalculatorExample.ts";

let expr: Parser<any> = null as any; // help TS with forward reference

/* from: https://en.wikipedia.org/wiki/Parsing_expression_grammar#Example 
    Expr    ← Sum
    Sum     ← Product (('+' / '-') Product)*
    Product ← Power (('*' / '/') Power)*
    Power   ← Value ('^' Power)?
    Value   ← [0-9]+ / '(' Expr ')'
*/

const value = or(
  num.map(r => parseInt(r.value)).tag("value"),
  seq("(", () => expr.tag("value"), ")"),
).map(r => r.tags.value[0]);

export const power: Parser<number> = seq(
  value.tag("base"),
  opt(seq("^", fn(() => power).tag("exp"))),
).map(r => {
  const { base, exp } = r.tags;
  const exponent = exp ? exp.slice(-1)[0] : 1;
  const result = base[0] ** exponent;
  return result;
});

export const product = seq(
  power.tag("pow"),
  repeat(seq(mulDiv, power).tag("mulDiv")),
).map(r => {
  const { pow, mulDiv } = r.tags;
  if (!mulDiv) return pow[0];
  const result = mulDiv.reduce((acc, opVal) => {
    const [op, val] = opVal;
    return op === "*" ? (acc *= val) : (acc /= val);
  }, pow[0]);
  return result;
});

export const sum = seq(
  product.tag("left"),
  repeat(seq(plusMinus, product).tag("sumOp")),
).map(r => {
  const { left, sumOp } = r.tags;
  if (!sumOp) return left[0];
  return sumOp.reduce((acc, opVal) => {
    const [op, val] = opVal;
    return op === "+" ? (acc += val) : (acc -= val);
  }, left[0]);
});
/* */ expr     = sum; // prettier-ignore

export const resultsStatement = expr as Parser<number>;

if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    value,
    power,
    product,
    sum,
    expr,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
