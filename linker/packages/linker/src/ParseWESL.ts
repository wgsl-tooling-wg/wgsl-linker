import { matchingLexer, ParserInit, SrcMap } from "mini-parse";
import { AbstractElem } from "./AbstractElems.ts";
import { mainTokens } from "./MatchWgslD.ts";
import { emptyScope, resetScopeIds, Scope } from "./Scope.ts";
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

  // root scope for this module
  rootScope: Scope;
}

/** unstable values used during parse collection */
export interface WeslParseContext {
  scope: Scope; // current scope (points somewhere in rootScope)
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

  const rootScope = emptyScope("module");

  // context is reset on parse failure during backtracking
  const context: WeslParseContext = { scope: rootScope };
  const stableState: StableState = { elems: [], params, rootScope };
  const app: WeslParseState = { context, state: stableState };

  const init: ParserInit = { lexer, app, srcMap, maxParseCount };
  const parseResult = grammar.parse(init);
  if (parseResult === null) {
    throw new Error("parseWESL failed");
  }

  return { elems: stableState.elems, scope: rootScope };
}
