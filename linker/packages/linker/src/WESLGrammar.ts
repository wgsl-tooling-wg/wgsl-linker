import {
  eof,
  fn,
  kind,
  opt,
  or,
  Parser,
  preParse,
  repeat,
  repeatPlus,
  req,
  seq,
  setTraceName,
  tagScope,
  text,
  tokens,
  tokenSkipSet,
  tracing,
  withSep,
  withSepPlus,
} from "mini-parse";
import { weslImport } from "./ImportGrammar.ts";
import { bracketTokens, mainTokens } from "./WESLTokens.ts";
import { comment } from "./CommentsGrammar.ts";
import {
  collectAttribute,
  collectFn,
  collectFnParam,
  collectModule,
  collectNameElem,
  collectSimpleElem,
  collectStruct,
  collectStructMember,
  collectVarLike,
  declIdentElem,
  expressionCollect,
  refIdent,
  scopeCollect,
  typeRefCollect,
} from "./WESLCollect.ts";

/** parser that recognizes key parts of WGSL and also directives like #import */

export const word = or(kind(mainTokens.ident), kind(mainTokens.textureStorage));

const qualified_ident = withSepPlus("::", word);

const diagnostic_rule_name = withSep(".", word, { requireOne: true });
const diagnostic_control = seq(
  "(",
  word,
  ",",
  diagnostic_rule_name,
  opt(","),
  ")",
);

/** list of words that we don't need to collect (e.g. for @interpolate) */
const word_list = seq("(", withSep(",", word, { requireOne: true }), ")");

// prettier-ignore
const attribute = tagScope(
  seq(
    "@",
    req(
      or(
        // These attributes have no arguments
        or(
          "compute",
          "const",
          "fragment",
          "invariant",
          "must_use",
          "vertex",
        )                                 .ptag("name"),
        // These attributes have arguments, but the argument doesn't have any identifiers
        seq(
          or("interpolate", "builtin")    .ptag("name"),
          req(() => word_list),
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
          )                               .ptag("name"),
          req(() => attribute_argument_list),
        ),
        // Everything else is also a normal attribute, it might have an expression list
        seq(
          word,
          opt(() => attribute_argument_list),
        ),
      ),
    ),
  )                                       .collect(collectAttribute),
)                                         .ctag("attribute");

// prettier-ignore
const attribute_argument_list = seq(
  "(",
  withSep(
    ",",
    fn(() => expression)               .collect(collectSimpleElem("attrParam"), "attrParam"),
  ),
  req(")"),
);

const argument_expression_list = seq(
  "(",
  withSep(",", () => expression),
  req(")"),
);

const opt_attributes = repeat(attribute);

/** parse an identifier into a TypeNameElem */
export const typeNameDecl = req(word.collect(declIdentElem, "typeName"));

/** parse an identifier into a TypeNameElem */
export const fnNameDecl = req(
  word.collect(declIdentElem, "fnName"),
  "missing fn name",
);

// prettier-ignore
const std_type_specifier = seq(
  word                              .collect(refIdent, "typeRefName"),
  () => opt_template_list,
)                                   .collect(typeRefCollect);

// none of the elements of a texture_storage type generator are bindable idents
// e.g. texture_storage_2d<rgba8unorm, write>
const texture_storage_type = seq(
  kind(mainTokens.textureStorage),
  () => opt_template_words,
); // TODO collect as TypeRefElem for completeness

// the first and optional third elements of a ptr template are not bindable idents:
// e.g. ptr<storage, MyStruct, read>
// prettier-ignore
const ptr_type = tagScope(
  seq(
    text("ptr")                     .ptag("typeRefName"),
    req("<"),
    word                            .ptag("templateParam"),
    req(","),
    () => template_parameter,
    opt(seq(",", word               .ptag("templateParam"))),
    req(">"),
  )                                 .collect(typeRefCollect),
)

// prettier-ignore
export const type_specifier: Parser<any> = tagScope(
  or(texture_storage_type, ptr_type, std_type_specifier),
)                                   .ctag("typeRefElem");

// prettier-ignore
const optionally_typed_ident = seq(
  word                              .collect(declIdentElem, "declIdent"),
  opt(seq(":", type_specifier)),
);

const req_optionally_typed_ident = req(optionally_typed_ident);

// prettier-ignore
export const struct_member = seq(
  opt_attributes                    .ctag("attributes"),
  word                              .collect(collectNameElem, "nameElem"),
  ":",
  req(type_specifier),
)                                   .collect(collectStructMember);

// prettier-ignore
export const struct_decl = seq(
  "struct",
  req(typeNameDecl),
  seq(
    req("{"),
    withSepPlus(",", struct_member)   .ptag("members"),
    req("}"),
  )                                   .collect(scopeCollect(), "struct_scope"),
)                                     .collect(collectStruct);

/** Also covers func_call_statement.post.ident */
// prettier-ignore
export const fn_call = seq(
  word                                .collect(refIdent, "fn_call.refIdent"), // we collect this in fnDecl, to attach to FnElem
  () => opt_template_list,
  argument_expression_list,
);

// prettier-ignore
const fnParam = tagScope(
  seq(
    opt_attributes,
    word                              .collect(declIdentElem, "paramName"),
    opt(seq(":", req(type_specifier))),
  )                                   .collect(collectFnParam),
)                                     .ctag("fnParam");

const fnParamList = seq("(", withSep(",", fnParam), ")");

// prettier-ignore
const local_variable_decl = seq(
  "var",
  () => opt_template_list,
  req_optionally_typed_ident,
  opt(seq("=", () => expression)),
)                                     .collect(collectVarLike("var"), "variable_decl");

// prettier-ignore
const global_variable_decl = seq(
  "var",
  () => opt_template_words,
  req_optionally_typed_ident,
  opt(seq("=", () => expression       .collect(scopeCollect(), "decl_scope"))),
);

/** Aka template_elaborated_ident.post.ident */
const opt_template_list = opt(
  seq(
    tokens(bracketTokens, "<"),
    withSepPlus(",", () => template_parameter),
    tokens(bracketTokens, ">"),
  ),
);

/** template list of non-identifier words. e.g. var <storage> */
const opt_template_words = opt(
  seq(
    tokens(bracketTokens, "<"),
    withSepPlus(",", () => word),
    tokens(bracketTokens, ">"),
  ),
);

// prettier-ignore
const template_elaborated_ident = 
  seq(
    word                              .collect(refIdent),
    opt_template_list,
  );

const literal = or("true", "false", kind(mainTokens.digits));

const paren_expression = seq("(", () => expression, req(")"));

const call_expression = seq(
  template_elaborated_ident,
  argument_expression_list,
);

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

/** a template_arg_expression with additional collection for parameters
 * that are types like array<f32> vs. expressions like 1+2 */
// prettier-ignore
const template_parameter = or(
  type_specifier                    .ctag("templateParam"),
  template_arg_expression           .collect(expressionCollect, "templateParam"),
);

const unscoped_compound_statement = seq(
  opt_attributes,
  text("{"),
  repeat(() => statement),
  req("}"),
);

// prettier-ignore
const compound_statement = seq(
  opt_attributes,
  seq(
    text("{"),
    repeat(() => statement),
    req("}"),
  )                                 .collect(scopeCollect()),
);

const for_init = or(
  fn_call,
  () => variable_or_value_statement,
  () => variable_updating_statement,
);

const for_update = or(fn_call, () => variable_updating_statement);

// prettier-ignore
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
    unscoped_compound_statement,
  )                                 .collect(scopeCollect()),
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
  seq(word.collect(refIdent), opt(component_or_swizzle)),
  seq("(", () => lhs_expression, ")", opt(component_or_swizzle)),
  seq("&", () => lhs_expression),
  seq("*", () => lhs_expression),
);

const variable_or_value_statement = or(
  // Also covers the = expression case
  local_variable_decl,
  seq("const", req_optionally_typed_ident, req("="), expression),
  seq("let", req_optionally_typed_ident, req("="), expression),
);

const variable_updating_statement = or(
  seq(
    lhs_expression,
    or("=", "<<=", ">>=", "%=", "&=", "*=", "+=", "-=", "/=", "^=", "|="), // TODO: try making this a lexer rule instead of a parser rule
    expression,
  ),
  seq(lhs_expression, or("++", "--")),
  seq("_", "=", expression),
);

// prettier-ignore
export const fn_decl = seq(
  opt_attributes,
  text("fn"),
  req(fnNameDecl),
  seq(
    req(fnParamList),
    opt(seq(
      "->", 
      opt_attributes, 
      type_specifier                  .ctag("returnType"))),
    req(unscoped_compound_statement),
  )                                   .collect(scopeCollect(), "body_scope"),
)                                     .collect(collectFn);

// prettier-ignore
const global_value_decl = or(
  seq(
    opt_attributes,
    "override",
    optionally_typed_ident,
    seq(opt(seq("=", expression       .collect(scopeCollect(), "decl_scope")))),
    ";",
  )                                   .collect(collectVarLike("override")),
  seq(
    "const",
    optionally_typed_ident,
    "=",
    seq(expression)                   .collect(scopeCollect(), "decl_scope"),
    ";",
  )                                   .collect(collectVarLike("const")),
);

// prettier-ignore
export const global_alias = seq(
  "alias",
  req(word)                           .collect(declIdentElem, "declIdent"),
  req("="),
  req(type_specifier)                 .collect(scopeCollect(), "decl_scope"),
  req(";"),
)                                     .collect(collectVarLike("alias"), "global_alias");

// prettier-ignore
const const_assert = 
  seq(
    "const_assert", 
    req(expression), 
    ";"
  )                                   .collect(collectSimpleElem("assert"),
);

const import_statement = weslImport;

const global_directive = seq(
  or(
    seq("diagnostic", diagnostic_control),
    seq("enable", withSep(",", word, { requireOne: true })),
    seq("requires", withSep(",", word, { requireOne: true })),
  ),
  ";",
);

// prettier-ignore
export const global_decl = tagScope(
  or(
    fn_decl,
    seq(
      opt_attributes, 
      global_variable_decl, 
      ";")                          .collect(collectVarLike("gvar"), "g_variable_decl"),
    global_value_decl,
    ";",
    global_alias,
    const_assert,
    struct_decl,
  ),
);

const end = tokenSkipSet(null, seq(repeat(kind(mainTokens.ws)), eof()));

// prettier-ignore
export const weslRoot = preParse(
  comment,
  seq(
    repeat(weslImport),
    repeat(or(global_directive, weslImport)),
    repeat(or(global_decl, weslImport)),
    req(end),
  )                                 .collect(collectModule, "collectModule"),
);

if (tracing) {
  const names: Record<string, Parser<unknown>> = {
    qualified_ident,
    diagnostic_rule_name,
    diagnostic_control,
    attribute,
    argument_expression_list,
    opt_attributes,
    typeNameDecl,
    fnNameDecl,
    type_specifier,
    optionally_typed_ident,
    struct_member,
    struct_decl,
    fn_call,
    fnParam,
    fnParamList,
    local_variable_decl,
    global_variable_decl,
    opt_template_list,
    template_elaborated_ident,
    literal,
    paren_expression,
    call_expression,
    primary_expression,
    component_or_swizzle,
    unary_expression,
    expression,
    template_arg_expression,
    compound_statement,
    for_init,
    for_update,
    for_statement,
    if_statement,
    loop_statement,
    case_selector,
    switch_clause,
    switch_body,
    switch_statement,
    while_statement,
    statement,
    lhs_expression,
    variable_or_value_statement,
    variable_updating_statement,
    fn_decl,
    global_value_decl,
    global_alias,
    const_assert,
    import_statement,
    global_directive,
    global_decl,
    end,
    weslRoot,
  };

  Object.entries(names).forEach(([name, parser]) => {
    setTraceName(parser, name);
  });
}
