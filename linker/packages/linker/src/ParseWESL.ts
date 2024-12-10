import { matchingLexer, ParserInit, SrcMap } from "mini-parse";
import { AbstractElem } from "./AbstractElems.ts";
import { AbstractElem2 } from "./AbstractElems2.ts";
import { mainTokens } from "./MatchWgslD.ts";
import { emptyScope, resetScopeIds, Scope } from "./Scope.ts";
import { OpenElem } from "./WESLCollect.ts";
import { weslRoot } from "./WESLGrammar.ts";

/** result of a parse */
export interface WeslAST {
  elems: AbstractElem[];
  elems2: AbstractElem2[];
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
  conditions: Record<string, any>;

  // legacy elems succesfully parsed in this module
  elems: AbstractElem[];

  // elems succesfully parsed in this module
  elems2: AbstractElem2[];

  // root scope for this module
  rootScope: Scope;
}

/** unstable values used during parse collection */
export interface WeslParseContext {
  scope: Scope; // current scope (points somewhere in rootScope)
  openElems: OpenElem[]; // elems that are collecting their contents
}

export function parseWESL(
  src: string,
  srcMap?: SrcMap,
  conditions: Record<string, any> = {},
  maxParseCount: number | undefined = undefined,
  grammar = weslRoot,
): WeslAST {
  // TODO allow returning undefined for failure, or throw?

  resetScopeIds();
  const lexer = matchingLexer(src, mainTokens);

  const rootScope = emptyScope("module");

  // context is reset on parse failure during backtracking
  const context: WeslParseContext = { scope: rootScope, openElems: [] };
  const elems: AbstractElem[] = [];
  const elems2: AbstractElem2[] = [];
  const stableState: StableState = { elems, elems2, conditions, rootScope };
  const app: WeslParseState = { context, state: stableState };

  const init: ParserInit = { lexer, app, srcMap, maxParseCount };
  const parseResult = grammar.parse(init);
  if (parseResult === null) {
    throw new Error("parseWESL failed");
  }

  return { elems, elems2, scope: rootScope };
}
