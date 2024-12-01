import { matchingLexer, ParserInit, SrcMap } from "mini-parse";
import { AbstractElem } from "./AbstractElems.ts";
import { mainTokens } from "./MatchWgslD.ts";
import { resetScopeIds, Scope } from "./Scope.ts";
import { weslRoot } from "./WESLGrammar.ts";

/** result of a parse */
export interface WeslAST {
  elems: AbstractElem[];
  scope: Scope;
}

/** stable and unstable state used during parsing */
export interface WeslParseState {
  context: WeslParseContext;
  state: StableState;
}

/** stable values used or accumulated during parsing */
export interface StableState {
  // parameters for evaluating conditions while parsing this module
  params: Record<string, any>;

  // elems succesfully parsed in this module
  elems: AbstractElem[];
}

/** unstable values used during parsing (these reset on backtracking) */
export interface WeslParseContext {
  rootScope: Scope; // provisional root scope, replaced with new version during parsing
  scope: Scope; // current scope (points at place in rootScope)
}

export function parseWESL(
  src: string,
  srcMap?: SrcMap,
  params: Record<string, any> = {},
  maxParseCount: number | undefined = undefined,
  grammar = weslRoot,
): WeslAST {
  // TODO allow returning undefined for failure, or throw?

  resetScopeIds();
  const lexer = matchingLexer(src, mainTokens);

  const moduleScope: Scope = {
    kind: "module",
    parent: null,
    idents: [],
    children: [],
  };

  // context is reset on parse failure during backtracking
  const context: WeslParseContext = {
    scope: moduleScope,
    rootScope: moduleScope,
  };
  const stableState: StableState = { elems: [], params };
  const app: WeslParseState = { context, state: stableState };

  const grammarCollectScope = grammar.map(
    r => (r.ctx.app.context as WeslParseContext).rootScope,
  );

  const init: ParserInit = { lexer, app, srcMap, maxParseCount };
  const parseResult = grammarCollectScope.parse(init);
  if (parseResult === null) {
    throw new Error("parseWESL failed");
  }

  // logScope("parseWESL root scope:", parseResult.value);

  return { elems: stableState.elems, scope: parseResult.value };
}
