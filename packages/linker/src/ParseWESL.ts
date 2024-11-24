import { matchingLexer, ParserInit, SrcMap } from "mini-parse";
import { AbstractElem } from "./AbstractElems.ts";
import { mainTokens } from "./MatchWgslD.ts";
import { WeslParseContext, weslRoot } from "./WESLGrammar.ts";

export function parseWESL(
  src: string,
  srcMap?: SrcMap,
  params: Record<string, any> = {},
  maxParseCount: number | undefined = undefined,
  grammar = weslRoot,
): AbstractElem[] {
  const lexer = matchingLexer(src, mainTokens);
  // state
  const state: AbstractElem[] = [];

  // context is reset on parse failure during backtracking
  const context: WeslParseContext = {
    params,
    provisionalIdents: [],
    provisionalScopes: [],
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

  return app.state;
}
