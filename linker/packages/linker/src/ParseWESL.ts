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
  elems: AbstractElem[]; // legacy
  rootModule: ModuleElem; // TODO rename to moduleElem
  imports: ImportTree[];
  flatImports?: FlatImport[]; // constructed on demand from import trees, and cached
  rootScope: Scope;
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

  // imports found in this module
  imports: ImportTree[];
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

  // const { rootModule, elems, rootScope, imports } = appState.stable;
  // return { rootModule: rootModule!, rootScope: rootScope, elems, imports };
  return appState.stable as WeslAST;
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

  const { rootModule, elems, rootScope, imports } = appState.stable;
  return { rootModule: rootModule!, rootScope: rootScope, elems, imports };
}

export function blankWeslParseState(): WeslParseState {
  const rootScope = emptyScope("module-scope");
  return {
    context: { scope: rootScope, openElems: [] },
    stable: { conditions: {}, elems: [], imports: [], rootScope },
  };
}

/** @return a flattened form of the import tree for convenience in binding idents. */
export function flatImports(ast: WeslAST): FlatImport[] {
  if (ast.flatImports) return ast.flatImports;

  const flat = ast.imports.flatMap(flattenTreeImport);
  ast.flatImports = flat;
  return flat;
}
