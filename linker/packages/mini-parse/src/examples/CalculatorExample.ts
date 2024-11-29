import { Parser, setTraceName } from "../Parser.js";
import { kind, opt, or, repeat, seq } from "../ParserCombinator.js";
import { tracing } from "../ParserTracing.js";
import { matchOneOf, tokenMatcher } from "../TokenMatcher.js";

export const calcTokens = tokenMatcher({
  number: /\d+/,
  ws: /\s+/,
  mulDiv: matchOneOf("* /"),
  plusMinus: matchOneOf("+ -"),
  symbol: matchOneOf("( ) ^"),
});

export const num       = kind(calcTokens.number); // prettier-ignore
export const plusMinus = kind(calcTokens.plusMinus); // prettier-ignore
export const mulDiv    = kind(calcTokens.mulDiv); // prettier-ignore

let expr: Parser<any> = null as any; // help TS with forward reference

/* from: https://en.wikipedia.org/wiki/Parsing_expression_grammar#Example 
    Expr    ← Sum
    Sum     ← Product (('+' / '-') Product)*
    Product ← Power (('*' / '/') Power)*
    Power   ← Value ('^' Power)?
    Value   ← [0-9]+ / '(' Expr ')'
*/

const value     = or(num, seq("(", expr, ")")); // prettier-ignore
const power:any = seq(value, opt(seq("^", () => power))); // prettier-ignore
const product   = seq(power, repeat(seq(mulDiv, power))); // prettier-ignore
const sum       = seq(product, repeat(seq(plusMinus, product))); // prettier-ignore
/* */ expr      = sum; // prettier-ignore

export const statement = repeat(expr);

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
