import { Intersection } from "../../mini-parse/src/CombinatorTypes.ts";
import {
  AbstractElem2,
  IdentElem,
  ModuleElem,
  VarElem,
} from "./AbstractElems2.ts";
import { LineWrapper } from "./LineWrapper.ts";

export function astTree(elem: AbstractElem2, indent = 0): string {
  const { kind, contents } = elem as ModuleElem;
  const str = new LineWrapper(indent);
  str.add(kind);
  addElemFields(elem, str);
  let childStrings: string[] = [];
  if (contents) {
    childStrings = contents.map(e => astTree(e, indent + 2));
  }
  if (childStrings.length) {
    str.nl();
    str.addBlock(childStrings.join("\n"), false);
  }

  return str.result;
}

function addElemFields(elem: AbstractElem2, str: LineWrapper) {
  addVarFields(elem, str) ||
    addTextFields(elem, str) ||
    addIdentFields(elem, str);
  return "";
}

function addVarFields(elem: AbstractElem2, str: LineWrapper): true | undefined {
  if (elem.kind === "var") {
    str.add(" " + elem.name.ident.originalName);
    if (elem.typeRef) {
      str.add(":" + elem.typeRef.ident.originalName);
    }
    return true;
  }
}

function addTextFields(
  elem: AbstractElem2,
  str: LineWrapper,
): true | undefined {
  if (elem.kind === "text") {
    const { src, start, end } = elem;
    str.add(` '${src.slice(start, end)}'`);
    return true;
  }
}
function addIdentFields(
  elem: AbstractElem2,
  str: LineWrapper,
): true | undefined {
  if (elem.kind === "ident") {
    const { ident } = elem;
    const prefix = ident.kind === "decl" ? "%" : "";
    str.add(" " + prefix + elem.ident.originalName);
    return true;
  }
}
