import { AppState, matchingLexer, ParserInit, SrcMap } from "mini-parse";
import { AbstractElem } from "./AbstractElems.ts";
import { ModuleElem } from "./AbstractElems2.ts";
import { ImportTree } from "./ImportTree.ts";
import { mainTokens } from "./MatchWgslD.ts";
import { emptyScope, resetScopeIds, Scope, SrcModule } from "./Scope.ts";
import { OpenElem } from "./WESLCollect.ts";
import { weslRoot } from "./WESLGrammar.ts";
import { FlatImport, flattenTreeImport } from "./FlattenTreeImport.ts";

/** result of a parse */
export interface WeslAST {
  /** root module element */
  moduleElem: ModuleElem;

  /** root scope for this module */
  rootScope: Scope;

  /** imports found in this module */
  imports: ImportTree[];

  /* constructed on demand from import trees, and cached */
  _flatImports?: FlatImport[];

  elems: AbstractElem[]; // legacy
}

/** stable and unstable state used during parsing */
export interface WeslParseState extends AppState<WeslParseContext> {
  context: WeslParseContext;
  stable: StableState;
}

/** stable values used or accumulated during parsing */
export type StableState  = WeslAST 

/** unstable values used during parse collection */
export interface WeslParseContext {
  scope: Scope; // current scope (points somewhere in rootScope)
  openElems: OpenElem[]; // elems that are collecting their contents
}

export function parseSrcModule(
  srcModule: SrcModule,
  srcMap?: SrcMap,
  maxParseCount: number | undefined = undefined,
): WeslAST {
  return parseWESL(srcModule.src, srcMap, maxParseCount);
}

export function parseWESL(
  src: string,
  srcMap?: SrcMap,
  maxParseCount: number | undefined = undefined,
): WeslAST {
  // TODO allow returning undefined for failure, or throw?

  resetScopeIds();
  const lexer = matchingLexer(src, mainTokens);

  const appState = blankWeslParseState();

  const init: ParserInit = { lexer, appState, srcMap, maxParseCount };
  const parseResult = weslRoot.parse(init);
  if (parseResult === null) {
    throw new Error("parseWESL failed");
  }

  return appState.stable as WeslAST;
}

export function blankWeslParseState(): WeslParseState {
  const rootScope = emptyScope("module-scope");
  const moduleElem = null as any; // we'll fill this in later
  return {
    context: { scope: rootScope, openElems: [] },
    stable: { elems: [], imports: [], rootScope, moduleElem },
  };
}

/** @return a flattened form of the import tree for convenience in binding idents. */
export function flatImports(ast: WeslAST): FlatImport[] {
  if (ast._flatImports) return ast._flatImports;

  const flat = ast.imports.flatMap(flattenTreeImport);
  ast._flatImports = flat;
  return flat;
}
