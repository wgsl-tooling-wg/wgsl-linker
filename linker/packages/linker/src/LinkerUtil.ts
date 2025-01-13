import { srcLog } from "mini-parse";
import {
  AbstractElem,
  ContainerElem,
  TerminalElem
} from "./AbstractElems.ts";

export function visitAst(
  elem: AbstractElem,
  visitor: (elem: AbstractElem) => void,
) {
  visitor(elem);
  if ((elem as ContainerElem).contents) {
    const container = elem as ContainerElem;
    container.contents.forEach(child => visitAst(child, visitor));
  }
}

export function elemLog(elem: TerminalElem, ...messages: any[]): void {
  srcLog(elem.srcModule.src, [elem.start, elem.end], ...messages);
}
