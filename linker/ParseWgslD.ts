import {
  anyNot,
  anyThrough,
  eof,
  ExtendedResult,
  kind,
  matchingLexer,
  opt,
  or,
  Parser,
  ParserContext,
  ParserInit,
  preParse,
  repeat,
  repeatPlus,
  req,
  seq,
  setTraceName,
  simpleParser,
  SrcMap,
  tokens,
  tracing,
  withSep,
} from "@wesl/mini-parse";
import { AbstractElem, TypeNameElem, TypeRefElem } from "./AbstractElems.ts";
import { identTokens, mainTokens } from "./MatchWgslD.ts";
import { directive } from "./ParseDirective.ts";
import {
  comment,
  literal,
  makeElem,
  unknown,
  word,
  wordNumArgs,
} from "./ParseSupport.ts";

/** parser that recognizes key parts of WGSL and also directives like #import */

const longIdent = kind(identTokens.longIdent);

// prettier gets confused if we leave the quoted parens inline so make consts for them here
const lParen = "(";
const rParen = ")";

export interface ParseState {
  params: Record<string, any>; // user provided params to templates, code gen and #if directives
}

const optAttributes = repeat(seq(kind(mainTokens.attr), opt(wordNumArgs)));
const possibleTypeRef = Symbol("typeRef");

const globalDirectiveOrAssert = seq(
  or("diagnostic", "enable", "requires", "const_assert"),
  req(anyThrough(";")),
).map(r => {
  const e = makeElem("globalDirective", r);
  r.app.state.push(e);
});

/** parse an identifier into a TypeNameElem */
export const typeNameDecl = req(word.tag("name")).map(r => {
  return makeElem("typeName", r, ["name"]) as TypeNameElem; // fix?
});

/** parse an identifier into a TypeNameElem */
export const fnNameDecl = req(word.tag("name"), "missing fn name").map(r => {
  return makeElem("fnName", r, ["name"]);
});

/** find possible references to user types (structs) in this possibly nested template */
export const template: Parser<any> = seq(
  "<",
  or(
    word.tag(possibleTypeRef), // only the first element of the template can be a type
    () => template,
  ),
  repeat(
    or(
      () => template,
      anyNot(">"), // we don't care about the rest of the template
    ),
  ),
  req(">"),
);

/** find possible references to user structs in this type specifier and any templates */
export const typeSpecifier: Parser<TypeRefElem[]> = seq(
  tokens(identTokens, longIdent.tag(possibleTypeRef)),
  opt(template),
).map(r =>
  r.tags[possibleTypeRef].map(name => {
    const e = makeElem("typeRef", r as ExtendedResult<any>);
    e.name = name;
    return e as Required<typeof e>;
  }),
);

export const structMember = seq(
  optAttributes,
  word.tag("name"),
  ":",
  req(typeSpecifier.tag("typeRefs")),
).map(r => {
  return makeElem("member", r, ["name", "typeRefs"]);
});

export const structDecl = seq(
  "struct",
  req(typeNameDecl).tag("nameElem"),
  req("{"),
  withSep(",", structMember).tag("members"),
  req("}"),
).map(r => {
  const e = makeElem("struct", r, ["members"]);
  const nameElem = r.tags.nameElem[0];
  e.nameElem = nameElem;
  e.name = nameElem.name;
  r.app.state.push(e);
});

// keywords that can be followed by (), not to be confused with fn calls
const callishKeyword = simpleParser("keyword", (ctx: ParserContext) => {
  const keywords = ["if", "for", "while", "const_assert", "return"];
  const token = ctx.lexer.next();
  const text = token?.text;
  if (text && keywords.includes(text)) {
    return text;
  }
});

export const fnCall = tokens(
  identTokens,
  seq(
    longIdent
      .tag("name")
      .map(r => makeElem("call", r, ["name"]))
      .tag("calls"), // we collect this in fnDecl, to attach to FnElem
    "(",
  ),
);

// prettier-ignore
const fnParam = seq(
  optAttributes,
  word,
  opt(seq(":", req(typeSpecifier.tag("typeRefs"))))
);

const fnParamList = seq(lParen, withSep(",", fnParam), rParen);

// prettier-ignore
const variableDecl = seq(
  or("const", "var", "let", "override"), 
  word, 
  ":", 
  req(typeSpecifier).tag("typeRefs")
);

// TODO: Fix everything else to also use this instead of "template"
const opt_template_args = opt(
  seq(
    "<",
    withSep(",", () => template_arg_expression, {
      requireOne: true,
    }),
    ">",
  ).tag("template"),
);

const primary_expression = or(
  literal,
  seq(
    word,
    opt_template_args,
    opt(
      seq(
        "(",
        withSep(",", () => expression),
        req(")"),
      ),
    ),
  ),
  seq("(", () => expression, req(")")),
);
const component_or_swizzle = repeatPlus(
  or(
    seq(".", word),
    seq("[", () => expression, req("]")),
  ),
);

/**
 * bitwise_expression.post.unary_expression
 * & ^ |
 * expression
 * && ||
 * relational_expression.post.unary_expression
 * > >= < <= != ==
 * shift_expression.post.unary_expression
 * % * / + - << >>
 */
const makeExpressionOperator = (isTemplate: boolean) => {
  const allowedOps = (
    "& | ^ << <= < != == % * / + -" + (isTemplate ? "" : " && || >> >= >")
  ).split(" ");
  return or(...allowedOps)
    .traceName("operator")
    .trace({
      shallow: true,
    });
};
const unary_expression: Parser<any> = or(
  seq(
    or(..."! & * - ~".split(" "))
      .traceName("unary_op")
      .trace({
        shallow: true,
      }),
    () => unary_expression,
  ),
  seq(primary_expression, opt(component_or_swizzle)),
);
const makeExpression = (isTemplate: boolean) => {
  return seq(
    unary_expression,
    repeat(seq(makeExpressionOperator(isTemplate), unary_expression)),
  );
};

export const expression = makeExpression(false);
const template_arg_expression = makeExpression(true);

const statement = repeatPlus(anyNot(or("{", "}"))); // TBD

const compound_statement = seq(optAttributes, "{", repeat(statement), "}");

const case_selector = or("default", expression);
const case_selectors = withSep(",", case_selector, { requireOne: true });
const case_clause = seq("case", case_selectors, opt(":"), compound_statement);
const default_alone_clause = seq("default", opt(":"), compound_statement);
const switch_clause = or(case_clause, default_alone_clause);

const switch_body = seq(optAttributes, "{", repeatPlus(switch_clause), "}");

const switch_statement = seq(optAttributes, "switch", expression, switch_body);

// prettier-ignore
const block: Parser<any> = seq(
  "{",
  repeat(
    or(
      switch_statement,
      callishKeyword,
      fnCall,
      () => block,
      variableDecl,
      anyNot("}")
    )
  ),
  req("}")
);

export const fnDecl = seq(
  optAttributes,
  "fn",
  req(fnNameDecl).tag("nameElem"),
  req(fnParamList),
  opt(seq("->", optAttributes, typeSpecifier.tag("typeRefs"))),
  req(block),
).map(r => {
  const e = makeElem("fn", r);
  const nameElem = r.tags.nameElem[0];
  e.nameElem = nameElem as Required<typeof nameElem>;
  e.name = nameElem.name;
  e.calls = r.tags.calls || [];
  e.typeRefs = r.tags.typeRefs?.flat() || [];
  r.app.state.push(e);
});

export const globalVar = seq(
  optAttributes,
  or("const", "override", "var"),
  opt(template),
  word.tag("name"),
  opt(seq(":", req(typeSpecifier.tag("typeRefs")))),
  req(anyThrough(";")),
).map(r => {
  const e = makeElem("var", r, ["name"]);
  e.typeRefs = r.tags.typeRefs?.flat() || [];
  r.app.state.push(e);
});

export const globalAlias = seq(
  "alias",
  req(word.tag("name")),
  req("="),
  req(typeSpecifier).tag("typeRefs"),
  req(";"),
).map(r => {
  const e = makeElem("alias", r, ["name", "typeRefs"]);
  r.app.state.push(e);
});

const globalDecl = or(fnDecl, globalVar, globalAlias, structDecl, ";");

const rootDecl = or(globalDirectiveOrAssert, globalDecl, directive, unknown);

const root = preParse(comment, seq(repeat(rootDecl), eof()));

export function parseWgslD(
  src: string,
  srcMap?: SrcMap,
  params: Record<string, any> = {},
  maxParseCount: number | undefined = undefined,
  grammar = root,
): AbstractElem[] {
  const lexer = matchingLexer(src, mainTokens);
  const state: AbstractElem[] = [];
  const context: ParseState = { params };
  const app = {
    context,
    state,
  };
  const init: ParserInit = {
    lexer,
    app,
    srcMap,
    maxParseCount,
  };

  grammar.parse(init);

  return app.state;
}

if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    globalDirectiveOrAssert,
    template,
    typeSpecifier,
    structMember,
    structDecl,
    fnCall,
    fnParam,
    fnParamList,
    opt_template_args,
    primary_expression,
    component_or_swizzle,
    expression,
    statement,
    compound_statement,
    case_selector,
    case_selectors,
    case_clause,
    default_alone_clause,
    switch_clause,
    switch_body,
    switch_statement,
    block,
    fnDecl,
    globalVar,
    globalAlias,
    globalDecl,
    rootDecl,
    root,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
