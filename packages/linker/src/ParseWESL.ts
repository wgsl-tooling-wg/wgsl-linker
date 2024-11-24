import { matchingLexer, ParserInit, SrcMap } from "mini-parse";
import { AbstractElem } from "./AbstractElems.ts";
import { mainTokens } from "./MatchWgslD.ts";
import { ParseState, weslRoot } from "./WESLGrammar.ts";

export function parseWESL(
  src: string,
  srcMap?: SrcMap,
  params: Record<string, any> = {},
  maxParseCount: number | undefined = undefined,
  grammar = weslRoot,
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
