/** */

import { dlog } from "berry-pretty";
import { AbstractElem } from "./AbstractElems.ts";
import { ParsedModule } from "./Linker2.ts";
import { emptyBodyScope, Ident, makeScope, Scope, SrcModule } from "./Scope.ts";

type BuilderElem = StartElem | EndElem | StartScope | EndScope | AddIdent;

interface BuilderElemBase {
  position: number;
}

interface StartElem extends BuilderElemBase {
  kind: "elem";
  elemKind: Pick<AbstractElem, "kind">;
  start: number;
  end: number;
}

interface EndElem extends BuilderElemBase {
  kind: "endElem";
}

interface StartScope extends BuilderElemBase {
  kind: "scope";
}

interface EndScope extends BuilderElemBase {
  kind: "endScope";
}

interface AddIdent extends BuilderElemBase {
  kind: "ident";
  ident: Ident;
}

export interface HasPosition {
  /** get the current position */
  position(): number;
}

export class AstBuilder {
  #elems: BuilderElem[] = [];

  constructor(
    readonly srcModule: SrcModule,
    readonly location: HasPosition,
  ) {}

  startElem(elemKind: Pick<AbstractElem, "kind">, start: number, end: number) {
    this.addElem("elem", { elemKind, start, end });
  }

  endElem() {
    this.addElem("endElem", {});
  }

  startScope() {
    this.addElem("scope", {});
  }

  endScope() {
    this.addElem("endScope", {});
  }

  addIdent(kind: Ident["kind"], start: number, end: number) {
    const originalName = this.srcModule.src.slice(start, end);
    const ident: Ident = { kind, originalName };
    this.addElem("ident", { ident });
    // TODO create IdentElem too
  }
  
  backtrack(pos: number) {
    let i = this.#elems.length - 1;
    while (i >= 0 && this.#elems[i].position > pos) {
      i--;
    }
    this.#elems.length = i + 1;
  }

  build(): ParsedModule {
    return buildAstAndScope(this.#elems);
  }


  private addElem<T extends BuilderElem>(
    kind: T["kind"],
    fields: Omit<T, "kind"|"position">,
  ) {
    const position = this.location.position();
    const elem = { kind, position, ...fields } as T;
    this.#elems.push(elem);
    // TODO create IdentElem too
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
