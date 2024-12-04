/** */

import { dlog } from "berry-pretty";
import { AbstractElem } from "./AbstractElems.ts";
import { ParsedModule } from "./Linker2.ts";
import { emptyBodyScope, Ident, makeScope, Scope, SrcModule } from "./Scope.ts";

export type BuilderElem =
  | StartElem
  | EndElem
  | StartScope
  | EndScope
  | AddIdent;

export interface StartElem {
  kind: "elem";
  elemKind: Pick<AbstractElem, "kind">;
  start: number;
  end: number;
}

export interface EndElem {
  kind: "endElem";
}

export interface StartScope {
  kind: "scope";
}

export interface EndScope {
  kind: "endScope";
}

export interface AddIdent {
  kind: "ident";
  ident: Ident;
}

export class AstBuilder {
  #elems: BuilderElem[] = [];

  constructor(readonly srcModule: SrcModule) {}

  startElem(elemKind: Pick<AbstractElem, "kind">, start: number, end: number) {
    this.#elems.push({ kind: "elem", elemKind, start, end });
  }

  endElem() {
    this.#elems.push({ kind: "endElem" });
  }

  startScope() {
    this.#elems.push({ kind: "scope" });
  }

  endScope() {
    this.#elems.push({ kind: "endScope" });
  }

  addIdent(kind: Ident["kind"], start: number, end: number) {
    const originalName = this.srcModule.src.slice(start, end);
    const ident: Ident = { kind, originalName };
    this.#elems.push({ kind: "ident", ident });
    // TODO create IdentElem too
  }

  build(): ParsedModule {
    return buildAstAndScope(this.#elems);
  }
}

export function buildAstAndScope(
  elems: BuilderElem[],
  scope = makeScope({ idents: [], parent: null, children: [], kind: "module" }),
  ast: AbstractElem[] = [],
): ParsedModule {
  let currentScope = scope;
  elems.forEach((elem, i) => {
    switch (elem.kind) {
      case "scope":
        const newScope = emptyBodyScope(currentScope);
        currentScope.children.push(newScope);
        currentScope = newScope;
        break;
      case "endScope":
        if (!currentScope.parent) {
          console.log(`endScope: unbalanced scope: build elem #${i}`);
          throw new Error(`endScope: unbalanced scope`);
        }
        currentScope = currentScope.parent;
        break;
      case "ident":
        currentScope.idents.push(elem.ident);
        break;
      default:
        dlog(`NYI elem kind: ${elem.kind} #${i}`);
        break;
    }
  });
  return { rootScope: scope, rootElems: ast };
}
