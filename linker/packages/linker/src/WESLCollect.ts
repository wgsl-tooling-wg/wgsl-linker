import { CollectContext } from "mini-parse";
import { emptyBodyScope, Ident } from "./Scope.ts";
import { WeslParseContext } from "./ParseWESL.ts";

/** add reference Ident to current scope */
export function refIdent(cc: CollectContext) {
  const originalName = cc.src.slice(cc.start, cc.end);
  // srcLog(cc.src, cc.start, "refIdent", originalName);
  const ident: Ident = { kind: "ref", originalName };
  const weslContext: WeslParseContext = cc.app.context;
  weslContext.scope.idents.push(ident);
  return originalName;
}

/** add declaration Ident to current scope */
export function declIdent(cc: CollectContext) {
  const weslContext: WeslParseContext = cc.app.context;
  const originalName = cc.src.slice(cc.start, cc.end);
  // srcLog(cc.src, cc.start, "declIdent", originalName);
  const ident: Ident = { kind: "decl", originalName };
  weslContext.scope.idents.push(ident);
  return originalName;
}

/** start a new child Scope */
export function startScope<T>(cc: CollectContext) {
  // ctxLog(r.ctx, "startScope");
  const { scope } = cc.app.context as WeslParseContext;
  const newScope = emptyBodyScope(scope);
  scope.children.push(newScope);
  cc.app.context.scope = newScope;
}

/** close current Scope and set current scope to parent */
export function completeScope<T>(cc: CollectContext) {
  // ctxLog(r.ctx, "completeScope");
  const weslContext = cc.app.context as WeslParseContext;
  const completedScope = weslContext.scope;
  const { parent } = completedScope;
  // TODO if scope is empty, drop it?
  if (parent) {
    weslContext.scope = parent;
  } else {
    // TODO should never happen
    const { idents, kind } = completedScope;
    console.log("ERR: completeScope, no parent scope", { kind, idents });
  }
}