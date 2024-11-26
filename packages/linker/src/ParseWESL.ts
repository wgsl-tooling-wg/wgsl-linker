import { matchingLexer, Parser, ParserInit, SrcMap } from "mini-parse";
import { AbstractElem } from "./AbstractElems.ts";
import { mainTokens } from "./MatchWgslD.ts";
import { WeslParseContext, weslRoot } from "./WESLGrammar.ts";
import { dlog } from "berry-pretty";
import { Scope } from "./Scope.ts";

export interface WeslAST {
  elems: AbstractElem[];
  scope: Scope;
}

export interface WeslParseState {
  context: WeslParseContext;
  state: WeslAST;
}

export function parseWESL(
  src: string,
  srcMap?: SrcMap,
  params: Record<string, any> = {},
  maxParseCount: number | undefined = undefined,
  grammar = weslRoot,
): WeslAST {
  const state = internalParseWesl(src, srcMap, params, maxParseCount, grammar);

  return state.state;
}

// exposed for testing. TODO get rid of this?
export function internalParseWesl(
  src: string,
  srcMap?: SrcMap,
  params: Record<string, any> = {},
  maxParseCount: number | undefined = undefined,
  grammar = weslRoot,
): WeslParseState {
  const lexer = matchingLexer(src, mainTokens);
  const scope: Scope = {
    kind: "module",
    parent: null,
    idents: [],
    children: [],
  };
  const state: WeslAST = { elems: [], scope };

  // context is reset on parse failure during backtracking
  const context: WeslParseContext = { params, scope };
  const app: WeslParseState = { context, state };
  const init: ParserInit = { lexer, app, srcMap, maxParseCount };

  grammar.parse(init);

  return app;
}
