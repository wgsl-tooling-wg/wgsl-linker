import { matchingLexer } from "../MatchingLexer.ts";
import { kind, seq } from "../ParserCombinator.ts";
import { matchOneOf, tokenMatcher } from "../TokenMatcher.ts";

const src = "fn foo()";

// lexer
const tokens = tokenMatcher({
  ident: /[a-z]+/,
  ws: /\s+/,
  symbol: matchOneOf("( ) [ ] { } ; ,"),
});
const lexer = matchingLexer(src, tokens);

// parsers
const ident = kind(tokens.ident);
const fnDecl = seq("fn", ident, "(", ")");

// parsing and extracing result
const result = fnDecl.parse({ lexer });
if (result) {
  const foundIdent = result.value[1];
  console.log(`found fn name: ${foundIdent}`);
}
