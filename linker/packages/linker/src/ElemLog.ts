import { AbstractElem2, ModuleElem } from "./AbstractElems2.ts";

export function elemToString(elem: AbstractElem2): string {
  const contents = elemContentsToLog(elem);

  const fields = elemFieldsToLog(elem);
  return `${elem.kind}${fields}${contents}`;
}

function elemContentsToLog(elem: AbstractElem2): string {
  const { contents } = elem as Partial<ModuleElem>;
  if (contents && contents.length) {
    const contains = contents.map(elemToString).join(", ");
    return ` [${contains}]`;
  }
  return "";
}

function elemFieldsToLog(elem: AbstractElem2): string {
  return textFieldsToLog(elem) || identFieldsToLog(elem) || "";
}

function textFieldsToLog(elem: AbstractElem2) {
  if (elem.kind === "text") {
    const { src, start, end } = elem;
    const text = src.slice(start, end);
    return ` '${text}'`;
  }
}

function identFieldsToLog(elem: AbstractElem2) {
  if (elem.kind === "ident") {
    const { ident } = elem;
    return ` '${ident.originalName}'`;
  }
}
