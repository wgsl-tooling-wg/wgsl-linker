import { AppState, matchingLexer, ParserInit, SrcMap } from "mini-parse";
import { AbstractElem } from "./AbstractElems.ts";
import { AbstractElem2, ModuleElem } from "./AbstractElems2.ts";
import { mainTokens } from "./MatchWgslD.ts";
import { emptyScope, resetScopeIds, Scope, SrcModule } from "./Scope.ts";
import { OpenElem } from "./WESLCollect.ts";
import { weslRoot } from "./WESLGrammar.ts";

/** result of a parse */
export interface WeslAST {
  elems: AbstractElem[]; // legacy
  rootModule: ModuleElem;
  scope: Scope;
}

/** stable and unstable state used during parsing */
export interface WeslParseState extends AppState<WeslParseContext> {
  context: WeslParseContext;
  stable: StableState;
}

/** stable values used or accumulated during parsing */
export interface StableState {
  // parameters for evaluating conditions while parsing this module
  conditions: Record<string, any>;

  // legacy elems succesfully parsed in this module
  elems: AbstractElem[];

  // elems succesfully parsed in this module
  rootModule?: ModuleElem;

  // root scope for this module
  rootScope: Scope;
}

/** unstable values used during parse collection */
export interface WeslParseContext {
  scope: Scope; // current scope (points somewhere in rootScope)
  openElems: OpenElem[]; // elems that are collecting their contents
}

export function parseSrcModule(
  srcModule: SrcModule,
  maxParseCount: number | undefined = undefined,
): WeslAST {
  const lexer = matchingLexer(srcModule.src, mainTokens);

  const appState = blankWeslParseState();

  const init: ParserInit = { lexer, appState, maxParseCount };
  const parseResult = weslRoot.parse(init);
  if (parseResult === null) {
    throw new Error("parseWESL failed");
  }

  const { rootModule, elems, rootScope } = appState.stable;
  return { rootModule: rootModule!, scope: rootScope, elems };
}

// TODO make wrapper on srcModule
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

  const appState = blankWeslParseState();

  const init: ParserInit = { lexer, appState: appState, srcMap, maxParseCount };
  const parseResult = grammar.parse(init);
  if (parseResult === null) {
    throw new Error("parseWESL failed");
  }

  const { rootModule, elems, rootScope } = appState.stable;
  return { rootModule: rootModule!, scope: rootScope, elems };
}

export function blankWeslParseState(): WeslParseState {
  const rootScope = emptyScope("module");
  return {
    context: { scope: rootScope, openElems: [] },
    stable: { conditions: {}, elems: [], rootScope },
  };
}
