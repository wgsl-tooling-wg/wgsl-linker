import { AbstractElem, ModuleElem } from "../AbstractElems.ts";
import { importToString } from "./ImportToString.ts";
import { LineWrapper } from "./LineWrapper.ts";

export function astTree(elem: AbstractElem, indent = 0): string {
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

export function elemToString(elem: AbstractElem): string {
  const { kind } = elem as ModuleElem;
  const str = new LineWrapper();
  str.add(kind);
  addElemFields(elem, str);
  let childStrings: string[] = [];
  if (childStrings.length) {
    str.nl();
    str.addBlock(childStrings.join("\n"), false);
  }
  return str.result;
}

function addElemFields(elem: AbstractElem, str: LineWrapper): void {
  addTextFields(elem, str) ||
    addVarishFields(elem, str) ||
    addStructFields(elem, str) ||
    addNameFields(elem, str) ||
    addFnFields(elem, str) ||
    addAliasFields(elem, str) ||
    addImport(elem, str) ||
    addRefIdent(elem, str) ||
    addDeclIdent(elem, str);
}

function addVarishFields(
  elem: AbstractElem,
  str: LineWrapper,
): true | undefined {
  const { kind } = elem;
  if (
    kind === "var" ||
    kind === "gvar" ||
    kind === "const" ||
    kind === "override"
  ) {
    str.add(" " + elem.name.ident.originalName);
    if (elem.typeRef) {
      str.add(":" + elem.typeRef.ident.originalName);
    }
    return true;
  }
}

function addTextFields(
  elem: AbstractElem,
  str: LineWrapper,
): true | undefined {
  if (elem.kind === "text") {
    const { srcModule, start, end } = elem;
    str.add(` '${srcModule.src.slice(start, end)}'`);
    return true;
  }
}

function addRefIdent(elem: AbstractElem, str: LineWrapper): true | undefined {
  if (elem.kind === "ref") {
    str.add(" " + elem.ident.originalName);
    return true;
  }
}

function addDeclIdent(elem: AbstractElem, str: LineWrapper): true | undefined {
  if (elem.kind === "decl") {
    str.add(" %" + elem.ident.originalName);
    return true;
  }
}

function addAliasFields(
  elem: AbstractElem,
  str: LineWrapper,
): true | undefined {
  if (elem.kind === "alias") {
    const { name, typeRef } = elem;
    const prefix = name.ident.kind === "decl" ? "%" : "";
    str.add(" " + prefix + name.ident.originalName);
    str.add("=" + typeRef.ident.originalName);
    return true;
  }
}

function addStructFields(
  elem: AbstractElem,
  str: LineWrapper,
): true | undefined {
  if (elem.kind === "struct") {
    str.add(" " + elem.name.ident.originalName);
    return true;
  }
}

function addImport(elem: AbstractElem, str: LineWrapper): true | undefined {
  if (elem.kind === "import") {
    str.add(" " + importToString(elem.imports));
    return true;
  }
}

function addNameFields(
  elem: AbstractElem,
  str: LineWrapper,
): true | undefined {
  if (elem.kind === "name") {
    str.add(" " + elem.name);
    return true;
  }
}

function addFnFields(elem: AbstractElem, str: LineWrapper): true | undefined {
  if (elem.kind === "fn") {
    const { name, params, returnType } = elem;
    str.add(" " + name.ident.originalName);

    str.add("(");
    const paramStrs = params
      .map(p => p.name.ident.originalName + ": " + p.typeRef.ident.originalName)
      .join(", ");
    str.add(paramStrs);
    str.add(")");

    if (returnType) {
      str.add(" -> " + returnType.ident.originalName);
    }

    return true;
  }
}
