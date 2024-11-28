import {
  anyThrough,
  eof,
  ExtendedResult,
  kind,
  opt,
  or,
  Parser,
  ParserContext,
  preParse,
  repeat,
  repeatPlus,
  req,
  seq,
  setTraceName,
  text,
  tokens,
  tokenSkipSet,
  tracing,
  withSep,
  withSepPlus,
} from "mini-parse";
import { CallElem, TypeNameElem, TypeRefElem } from "./AbstractElems.ts";
import { bracketTokens, identTokens, mainTokens } from "./MatchWgslD.ts";
import { directive } from "./ParseDirective.ts";
import { comment, makeElem, unknown, word } from "./ParseSupport.ts";
import { WeslParseContext } from "./ParseWESL.ts";
import {
  identLocToCallElem,
  identToTypeRefOrLocation,
} from "./ParsingHacks.ts";
import {
  Ident,
  Scope,
  ScopeKind,
  withAddedIdent,
  withChildScope,
} from "./Scope.ts";

/** parser that recognizes key parts of WGSL and also directives like #import */

const longIdent = kind(identTokens.longIdent);
const ident = word; // TODO longIdent?

// prettier gets confused if we leave the quoted parens inline so make consts for them here
const lParen = "(";
const rParen = ")";

// TODO: stef Check the following
// - translation_unit
// - global_decl
// - global_value_decl
// - global_directive
// - diagnostic_rule_name
// - diagnostic_control

const attribute = seq(
  "@",
  req(
    or(
      // These attributes have no arguments
      or("compute", "const", "fragment", "invariant", "must_use", "vertex"),
      // These attributes have arguments, but the argument doesn't have any identifiers
      seq(
        or("interpolate", "builtin", "diagnostic"),
        req(() => argument_expression_list), // TODO: Throw away the identifiers
      ),
      // These are normal attributes
      seq(
        or(
          "workgroup_size",
          "align",
          "binding",
          "blend_src",
          "group",
          "id",
          "location",
          "size",
        ),
        req(() => argument_expression_list),
      ),
      // Everything else is also a normal attribute, it might have an expression list
      seq(
        kind(mainTokens.word),
        opt(() => argument_expression_list),
      ),
    ),
  ),
);

const argument_expression_list = seq(
  "(",
  withSep(",", () => expression),
  req(")"),
);

const opt_attributes = repeat(attribute);
const possibleTypeRef = Symbol("typeRef");

const globalDirectiveOrAssert = seq(
  or("diagnostic", "enable", "requires", "const_assert"),
  req(anyThrough(";")),
).map(r => {
  const e = makeElem("globalDirective", r);
  r.app.state.elems.push(e);
});

/** parse an identifier into a TypeNameElem */
export const typeNameDecl = req(word.tag("name")).map(r => {
  return makeElem("typeName", r, ["name"]) as TypeNameElem; // fix?
});

/** parse an identifier into a TypeNameElem */
export const fnNameDecl = req(
  word.tag("name").map(declIdent),
  "missing fn name",
).map(r => {
  return makeElem("fnName", r, ["name"]);
});

/** find possible references to user structs in this type specifier and any templates */
export const type_specifier: Parser<TypeRefElem[]> = seq(
  tokens(identTokens, longIdent.tag(possibleTypeRef)),
  () => opt_template_list,
).map(r =>
  r.tags[possibleTypeRef].map(name => {
    const e = makeElem("typeRef", r as ExtendedResult<any>);
    e.name = name;
    return e as Required<typeof e>;
  }),
);

const optionally_typed_ident = seq(
  word.map(declIdent),
  opt(seq(":", type_specifier.tag("typeRefs"))),
);

const req_optionally_typed_ident = req(optionally_typed_ident);

export const structMember = seq(
  opt_attributes,
  word.tag("name"),
  ":",
  req(type_specifier.tag("typeRefs")),
).map(r => {
  return makeElem("member", r, ["name", "typeRefs"]);
});

export const structDecl = seq(
  "struct",
  req(typeNameDecl).tag("nameElem"),
  req("{"),
  withSep(",", structMember, { requireOne: true }).tag("members"),
  req("}"),
).map(r => {
  const e = makeElem("struct", r, ["members"]);
  const nameElem = r.tags.nameElem[0];
  e.nameElem = nameElem;
  e.name = nameElem.name;
  r.app.state.elems.push(e);
});

/** Also covers func_call_statement.post.ident */
export const fn_call = seq(
  tokens(identTokens, longIdent) // TODO should longIdent be in mainTokens?
    .tag("name")
    .map(r => makeElem("call", r, ["name"]))
    .tag("calls"), // we collect this in fnDecl, to attach to FnElem
  () => opt_template_list,
  argument_expression_list,
);

/// add reference ident to current scope
function refIdent(r: ExtendedResult<any>) {
  const weslContext: WeslParseContext = r.ctx.app.context;
  const originalName = r.src.slice(r.start, r.end);
  // ctxLog(r.ctx, "refIdent", originalName);
  const ident: Ident = { kind: "ref", originalName };
  r.ctx.app.context = addIdent(weslContext, ident);
}

function declIdent(r: ExtendedResult<any>) {
  const weslContext: WeslParseContext = r.ctx.app.context;
  const originalName = r.src.slice(r.start, r.end);
  // ctxLog(r.ctx, "declIdent", originalName);
  const ident: Ident = { kind: "decl", originalName };
  r.ctx.app.context = addIdent(weslContext, ident);
  return originalName;
}

/** return a new context with an identifier added to the scope
 * this allows for backtracking */
function addIdent(
  weslContext: WeslParseContext,
  ident: Ident,
): WeslParseContext {
  const { rootScope: origRoot, scope: origScope } = weslContext;
  const { rootScope, scope } = withAddedIdent(origRoot, origScope, ident);
  // logScope(`added addIdent '${ident.originalName}'. rootScope`, rootScope);
  return { ...weslContext, scope, rootScope };
}

function startScope<T>(r: ExtendedResult<T>): T {
  // ctxLog(r.ctx, "startScope");
  return startScopeKind(r, "body");
}

function completeScope<T>(r: ExtendedResult<T>): T {
  // ctxLog(r.ctx, "completeScope");
  const ctx: ParserContext = r.ctx;
  const weslContext: WeslParseContext = ctx.app.context;
  const completedScope = weslContext.scope;
  const { parent } = completedScope;
  if (parent) {
    weslContext.scope = parent;
  } else {
    // TODO should never happen
    const { idents, kind } = completedScope;
    console.error("completeScope, no parent scope", { kind, idents });
  }
  return r.value;
}

function startScopeKind<T>(r: ExtendedResult<any>, kind: ScopeKind): T {
  const ctx: ParserContext = r.ctx;
  const weslContext: WeslParseContext = ctx.app.context;
  const { rootScope, scope } = weslContext;
  const parentScope = scope;
  const newScope: Scope = {
    idents: [],
    parent: parentScope,
    children: [],
    kind,
  };
  r.ctx.app.context = withChildScope(rootScope, scope, newScope);
  return r.value;
}

// prettier-ignore
const fnParam = seq(
  opt_attributes,
  word,
  opt(seq(":", req(type_specifier.tag("typeRefs")))),
);

const fnParamList = seq(lParen, withSep(",", fnParam), rParen);

/** Covers variable_decl and the 'var' case in global_decl */
const variable_decl = seq(
  "var",
  () => opt_template_list,
  req_optionally_typed_ident,
  opt(seq("=", () => expression)),
);

/** Aka template_elaborated_ident.post.ident */
const opt_template_list = opt(
  seq(
    tokens(bracketTokens, "<"),
    withSepPlus(",", () => template_arg_expression),
    tokens(bracketTokens, ">"),
  ).tag("template"),
);

const template_elaborated_ident = seq(
  ident.map(identToTypeRefOrLocation).tag("identLoc"),
  opt_template_list,
);

const literal = or("true", "false", kind(mainTokens.digits));

const paren_expression = seq("(", () => expression, req(")"));

const call_expression = seq(template_elaborated_ident, argument_expression_list)
  .map(identLocToCallElem)
  .tag("calls");

const primary_expression = or(
  literal,
  paren_expression,
  call_expression,
  template_elaborated_ident,
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
  return or(...allowedOps);
};

const unary_expression: Parser<any> = or(
  seq(or(..."! & * - ~".split(" ")), () => unary_expression),
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

const compound_statement = seq(
  opt_attributes,
  text("{").map(startScope),
  repeat(() => statement),
  req("}").map(completeScope),
);

const for_init = or(
  fn_call,
  () => variable_or_value_statement,
  () => variable_updating_statement,
);

const for_update = or(fn_call, () => variable_updating_statement);

const for_statement = seq(
  opt_attributes,
  "for",
  seq(
    req("("),
    opt(for_init),
    req(";"),
    opt(expression),
    req(";"),
    opt(for_update),
    req(")"),
  ),
);

const if_statement = seq(
  opt_attributes,
  "if",
  req(seq(expression, compound_statement)),
  repeat(seq("else", "if", req(seq(expression, compound_statement)))),
  opt(seq("else", req(compound_statement))),
);
const loop_statement = seq(
  opt_attributes,
  "loop",
  opt_attributes,
  req(
    seq(
      "{",
      repeat(() => statement),
      opt(
        seq(
          "continuing",
          opt_attributes,
          "{",
          repeat(() => statement),
          opt(seq("break", "if", expression, ";")),
          "}",
        ),
      ),
      "}",
    ),
  ),
);

const case_selector = or("default", expression);
const switch_clause = or(
  seq(
    "case",
    withSep(",", case_selector, { requireOne: true }),
    opt(":"),
    compound_statement,
  ),
  seq("default", opt(":"), compound_statement),
);

const switch_body = seq(opt_attributes, "{", repeatPlus(switch_clause), "}");
const switch_statement = seq(opt_attributes, "switch", expression, switch_body);

const while_statement = seq(
  opt_attributes,
  "while",
  expression,
  compound_statement,
);

const statement: Parser<any> = or(
  for_statement,
  if_statement,
  loop_statement,
  switch_statement,
  while_statement,
  compound_statement,
  seq("break", ";"),
  seq("continue", ";"),
  seq(";"),
  seq("const_assert", expression, ";"),
  seq("discard", ";"),
  seq("return", opt(expression), ";"),
  seq(fn_call, ";"),
  seq(() => variable_or_value_statement, ";"),
  seq(() => variable_updating_statement, ";"),
);

const lhs_expression: Parser<any> = or(
  seq(word.tag("ident").map(refIdent), opt(component_or_swizzle)),
  seq("(", () => lhs_expression, ")", opt(component_or_swizzle)),
  seq("&", () => lhs_expression),
  seq("*", () => lhs_expression),
);

const variable_or_value_statement = or(
  // Also covers the = expression case
  variable_decl,
  seq("const", req_optionally_typed_ident, req("="), expression),
  seq("let", req_optionally_typed_ident, req("="), expression),
);

const variable_updating_statement = or(
  seq(
    lhs_expression,
    or(
      "=",
      "<<=", // TODO could this be handled with a lexer rule?
      ">>=",
      "%=",
      "&=",
      "*=",
      "+=",
      "-=",
      "/=",
      "^=",
      "|=",
    ),
    expression,
  ),
  seq(lhs_expression, or("++", "--")), // TODO was op("++"), but this fixes the 'parse for' test ..
  seq("_", "=", expression),
);

export const fn_decl = seq(
  opt_attributes,
  text("fn"),
  req(fnNameDecl).tag("nameElem"),
  req(fnParamList),
  opt(seq("->", opt_attributes, type_specifier.tag("typeRefs"))),
  req(compound_statement),
).map(r => {
  const e = makeElem("fn", r);
  const nameElem = r.tags.nameElem[0];
  e.nameElem = nameElem as Required<typeof nameElem>;
  e.name = nameElem.name;
  e.calls = (r.tags.calls as CallElem[][])?.flat() || [];
  e.typeRefs = r.tags.typeRefs?.flat() || [];
  r.app.state.elems.push(e);
});

export const globalVar = seq(
  opt_attributes,
  or("const", "override", "var"),
  opt_template_list,
  word.tag("name"),
  opt(seq(":", req(type_specifier.tag("typeRefs")))),
  req(anyThrough(";")),
).map(r => {
  const e = makeElem("var", r, ["name"]);
  e.typeRefs = r.tags.typeRefs?.flat() || [];
  r.app.state.elems.push(e);
});

export const globalAlias = seq(
  "alias",
  req(word.tag("name")),
  req("="),
  req(type_specifier).tag("typeRefs"),
  req(";"),
).map(r => {
  const e = makeElem("alias", r, ["name", "typeRefs"]);
  r.app.state.elems.push(e);
});

const globalDecl = or(fn_decl, globalVar, globalAlias, structDecl, ";");

const rootDecl = or(globalDirectiveOrAssert, globalDecl, directive, unknown);

const end = tokenSkipSet(null, seq(repeat(kind(mainTokens.ws)), eof()));

export const weslRoot = preParse(comment, seq(repeat(rootDecl), end));

if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    attribute,
    globalDirectiveOrAssert,
    type_specifier,
    structMember,
    structDecl,
    fn_call,
    fnParam,
    fnParamList,
    opt_template_list,
    template_elaborated_ident,
    literal,
    paren_expression,
    call_expression,
    primary_expression,
    component_or_swizzle,
    expression,
    statement,
    lhs_expression,
    variable_or_value_statement,
    variable_updating_statement,
    compound_statement,
    for_init,
    for_update,
    for_statement,
    case_selector,
    switch_clause,
    switch_body,
    switch_statement,
    fn_decl,
    globalVar,
    globalAlias,
    globalDecl,
    rootDecl,
    weslRoot,
    end,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}