import {
  anyThrough,
  eof,
  ExtendedResult,
  kind,
  matchingLexer,
  opt,
  or,
  Parser,
  ParserInit,
  preParse,
  repeat,
  repeatPlus,
  req,
  seq,
  setTraceName,
  SrcMap,
  tokens,
  tracing,
  withSep,
  withSepPlus,
} from "mini-parse";
import {
  AbstractElem,
  CallElem,
  TypeNameElem,
  TypeRefElem,
} from "./AbstractElems.ts";
import { bracketTokens, identTokens, mainTokens } from "./MatchWgslD.ts";
import { directive } from "./ParseDirective.ts";
import { comment, makeElem, unknown, word } from "./ParseSupport.ts";
import { gleamImport } from "./GleamImport.ts";

/** parser that recognizes key parts of WGSL and also directives like #import */

const ident = word;

export interface ParseState {
  params: Record<string, any>; // user provided params to templates, code gen and #if directives
}

const diagnostic_rule_name = withSep(".", word, { requireOne: true });
const diagnostic_control = seq(
  "(",
  word,
  ",",
  diagnostic_rule_name,
  opt(","),
  ")",
);

const attribute = seq(
  "@",
  req(
    or(
      // These attributes have no arguments
      or("compute", "const", "fragment", "invariant", "must_use", "vertex"),
      // These attributes have arguments, but the argument doesn't have any identifiers
      seq(
        or("interpolate", "builtin"),
        req(() => argument_expression_list), // TODO: Throw away the identifiers
      ),
      seq("diagnostic", diagnostic_control),
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
const possibleTypeRef = "typeRef";

/** parse an identifier into a TypeNameElem */
export const typeNameDecl = req(word.tag("name")).map(r => {
  return makeElem("typeName", r, ["name"]) as TypeNameElem; // fix?
});

/** parse an identifier into a TypeNameElem */
export const fnNameDecl = req(word.tag("name"), "missing fn name").map(r => {
  return makeElem("fnName", r, ["name"]);
});

export const type_specifier: Parser<TypeRefElem[]> = seq(
  word.tag(possibleTypeRef),
  () => opt_template_list,
).map(r =>
  r.tags[possibleTypeRef].map(name => {
    const e = makeElem("typeRef", r as ExtendedResult<any>);
    e.name = name;
    return e as Required<typeof e>;
  }),
);

const optionally_typed_ident = seq(
  word.tag("name"),
  opt(seq(":", type_specifier.tag("typeRefs"))),
);

export const struct_member = seq(
  opt_attributes,
  word.tag("name"),
  ":",
  req(type_specifier.tag("typeRefs")),
).map(r => {
  return makeElem("member", r, ["name", "typeRefs"]);
});

export const struct_decl = seq(
  "struct",
  req(typeNameDecl).tag("nameElem"),
  req("{"),
  withSep(",", struct_member, { requireOne: true }).tag("members"),
  req("}"),
).map(r => {
  const e = makeElem("struct", r, ["members"]);
  const nameElem = r.tags.nameElem[0];
  e.nameElem = nameElem;
  e.name = nameElem.name;
  r.app.state.push(e);
});

/** Also covers func_call_statement.post.ident */
export const fn_call = seq(
  word
    .tag("name")
    .map(r => makeElem("call", r, ["name"]))
    .tag("calls"), // we collect this in fnDecl, to attach to FnElem
  () => opt_template_list,
  argument_expression_list,
);

// prettier-ignore
const fnParam = seq(
  opt_attributes,
  word,
  opt(seq(":", req(type_specifier.tag("typeRefs")))),
);

const fnParamList = seq("(", withSep(",", fnParam), ")");

/** Covers variable_decl and the 'var' case in global_decl */
const variable_decl = seq(
  "var",
  () => opt_template_list,
  optionally_typed_ident,
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
  "{",
  repeat(() => statement),
  "}",
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
  () => const_assert,
  seq("discard", ";"),
  seq("return", opt(expression), ";"),
  seq(fn_call, ";"),
  seq(() => variable_or_value_statement, ";"),
  seq(() => variable_updating_statement, ";"),
);

const lhs_expression: Parser<any> = or(
  seq(word.tag("ident"), opt(component_or_swizzle)),
  seq("(", () => lhs_expression, ")", opt(component_or_swizzle)),
  seq("&", () => lhs_expression),
  seq("*", () => lhs_expression),
);

const variable_or_value_statement = or(
  // Also covers the = expression case
  variable_decl,
  seq("const", optionally_typed_ident, req("="), expression),
  seq("let", optionally_typed_ident, req("="), expression),
);

const variable_updating_statement = or(
  seq(
    lhs_expression,
    or("=", "<<=", ">>=", "%=", "&=", "*=", "+=", "-=", "/=", "^=", "|="),
    expression,
  ),
  seq(lhs_expression, or("++", "--")),
  seq("_", "=", expression),
);

export const fn_decl = seq(
  opt_attributes,
  "fn",
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
  r.app.state.push(e);
});

const global_value_decl = or(
  seq(
    opt_attributes,
    "override",
    optionally_typed_ident,
    opt(seq("=", expression)),
  ),
  seq("const", optionally_typed_ident, "=", expression),
);

export const global_alias = seq(
  "alias",
  req(word.tag("name")),
  req("="),
  req(type_specifier).tag("typeRefs"),
  req(";"),
).map(r => {
  const e = makeElem("alias", r, ["name", "typeRefs"]);
  r.app.state.push(e);
});

const const_assert = seq("const_assert", req(expression), ";");

const import_statement = gleamImport;

const global_directive = seq(
  or(
    seq("diagnostic", diagnostic_control),
    seq("enable", withSep(",", word, { requireOne: true })),
    seq("requires", withSep(",", word, { requireOne: true })),
  ),
  ";",
).map(r => {
  const e = makeElem("globalDirective", r);
  r.app.state.push(e);
});

export const global_decl = or(
  fn_decl,
  seq(opt_attributes, variable_decl, ";").map(r => {
    const e = makeElem("var", r, ["name"]);
    e.typeRefs = r.tags.typeRefs?.flat() || [];
    r.app.state.push(e);
  }),
  seq(global_value_decl, ";").map(r => {
    const e = makeElem("var", r, ["name"]);
    e.typeRefs = r.tags.typeRefs?.flat() || [];
    r.app.state.push(e);
  }),
  ";",
  global_alias,
  const_assert,
  struct_decl,
);

const root = preParse(
  comment,
  seq(
    repeat(or(import_statement, directive)),
    repeat(or(global_directive, directive)),
    repeat(or(global_decl, directive)),
    eof(),
  ),
);

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
    attribute,
    type_specifier,
    structMember: struct_member,
    structDecl: struct_decl,
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
    globalAlias: global_alias,
    globalDecl: global_decl,
    root,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}

interface IdentLocation {
  name: string;
  start: number;
  end: number;
}

/** Make a TypeRefElem if the ident value starts with an upper case letter,
 * and push the elem into the result tags.
 * Otherwise, make and IdentLocation and return that.
 * TODO-lee this keeps some tests alive, but drop this hack soon, when we get rid of typeRefs.
 */
function identToTypeRefOrLocation(r: ExtendedResult<any>): IdentLocation[] {
  const firstChar = r.value[0];
  if (firstChar === firstChar.toUpperCase()) {
    // ctxLog(r.ctx, `making typeRef ${r.value}`);
    const e = makeElem("typeRef", r as ExtendedResult<any>);
    e.name = r.value;
    const typeRef = e as Required<typeof e>;
    const tags = r.tags as Record<string, any>;
    const refs = (tags.typeRefs as TypeRefElem[]) || [];
    refs.push(typeRef);
    tags.typeRefs = refs;
    return [];
  } else {
    const identLocation: IdentLocation = {
      name: r.value,
      start: r.start,
      end: r.end,
    };
    return [identLocation];
  }
}

/** Make a call elem if there's an "identLoc" tag from identToTypeRefOrLocation.
 *
 * TODO-lee this keeps some tests alive, but drop this hack soon.
 */
function identLocToCallElem(r: ExtendedResult<any>): CallElem[] {
  const idents = (r.tags.identLoc as IdentLocation[][]).flat();
  const calls: CallElem[] = idents.map(i => ({
    kind: "call",
    name: i.name,
    start: i.start,
    end: i.end,
  }));
  return calls;
}
