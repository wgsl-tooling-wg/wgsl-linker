import { expect, test } from "vitest";
import { matchingLexer } from "../MatchingLexer.js";
import { kind, opt, repeat, seq } from "../ParserCombinator.js";
import { matchOneOf, tokenMatcher } from "../TokenMatcher.js";

test("parse fn foo()", () => {
  const src = "fn foo()";

  // lexer
  const tokens = tokenMatcher({
    ident: /[a-z]+/,
    ws: /\s+/,
    symbol: matchOneOf("( ) [ ] { } @ ; ,"),
  });
  const lexer = matchingLexer(src, tokens);

  // parsers
  const ident = kind(tokens.ident);
  const fnDecl = seq("fn", ident, "(", ")");

  // parsing and extracint result
  const result = fnDecl.parse({ lexer });

  if (result) {
    const foundIdent = result.value[1];
    expect(foundIdent).toBe("foo");
  }
  expect(result).toBeDefined();
});

test("parse fn foo() with annotation in grammar", () => {
  const src = "fn foo()";

  // lexer
  const tokens = tokenMatcher({
    ident: /[a-z]+/,
    ws: /\s+/,
    symbol: matchOneOf("( ) [ ] { } @ ; ,"),
  });
  const lexer = matchingLexer(src, tokens);

  // parsers
  const ident = kind(tokens.ident);
  const annotation = opt(seq("@", ident));
  const fnDecl = seq(annotation, "fn", ident, "(", ")");

  // parsing and extracting result
  const result = fnDecl.parse({ lexer });

  if (result) {
    const fnName = result.value[2];
    expect(fnName).toBe("foo");
  }
  expect(result).toBeDefined();
});

test("parse fn foo() with tagged results", () => {
  const src = "@export fn foo()";

  // lexer
  const tokens = tokenMatcher({
    ident: /[a-z]+/,
    ws: /\s+/,
    symbol: matchOneOf("( ) [ ] { } @ ; ,"),
  });
  const lexer = matchingLexer(src, tokens);

  // parsers
  const ident = kind(tokens.ident);
  const annotation = repeat(seq("@", ident.tag("annotation")));
  const fnDecl = seq(annotation, "fn", ident.tag("fnName"), "(", ")");

  // parsing and extracting result
  const result = fnDecl.parse({ lexer });

  expect(result).toBeDefined();
  if (result) {
    const [fnName] = result.tags.fnName;
    expect(fnName).toBe("foo");
    const annotations: string[] = result.tags.annotation;
    expect(annotations).to.toEqual(["export"]);
  }
});
