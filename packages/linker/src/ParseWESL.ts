import { matchingLexer, Parser, ParserInit, SrcMap } from "mini-parse";
import { AbstractElem } from "./AbstractElems.ts";
import { mainTokens } from "./MatchWgslD.ts";
import { WeslParseContext, weslRoot } from "./WESLGrammar.ts";
import { dlog } from "berry-pretty";

export function parseWESL(
  src: string,
  srcMap?: SrcMap,
  params: Record<string, any> = {},
  maxParseCount: number | undefined = undefined,
  grammar = weslRoot,
): AbstractElem[] {
  const state = internalParseWesl(src, srcMap, params, maxParseCount, grammar);

  return state.state;
}

interface WeslParseState {
  context: WeslParseContext;
  state: AbstractElem[];
}

export function internalParseWesl(
  src: string,
  srcMap?: SrcMap,
  params: Record<string, any> = {},
  maxParseCount: number | undefined = undefined,
  grammar = weslRoot,
): WeslParseState {
  const lexer = matchingLexer(src, mainTokens);
  // state
  const state: AbstractElem[] = [];

  // context is reset on parse failure during backtracking
  const context: WeslParseContext = {
    params,
    scope: { kind: "module", parent: null, idents: [], children: [] },
  };
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

  return app;
}
