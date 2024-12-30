import { AbstractElem2, ModuleElem } from "./AbstractElems2.ts";
import { treeToString } from "./ImportTree.ts";
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

function addElemFields(elem: AbstractElem2, str: LineWrapper): void {
  addTextFields(elem, str) ||
    addVarishFields(elem, str) ||
    addStructFields(elem, str) ||
    addNameFields(elem, str) ||
    addFnFields(elem, str) ||
    addAliasFields(elem, str) ||
    addImport(elem, str) ||
    addIdentFields(elem, str);
}

function addVarishFields(
  elem: AbstractElem2,
  str: LineWrapper,
): true | undefined {
  const { kind } = elem;
  if (kind === "var" || kind === "const" || kind === "override") {
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

function addAliasFields(
  elem: AbstractElem2,
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
  elem: AbstractElem2,
  str: LineWrapper,
): true | undefined {
  if (elem.kind === "struct") {
    str.add(" " + elem.name.ident.originalName);
    return true;
  }
}

function addImport(elem: AbstractElem2, str: LineWrapper): true | undefined {
  if (elem.kind === "import") {
    str.add(" " + treeToString(elem.imports));
    return true;
  }
}

function addNameFields(
  elem: AbstractElem2,
  str: LineWrapper,
): true | undefined {
  if (elem.kind === "name") {
    str.add(" " + elem.name);
    return true;
  }
}

function addFnFields(elem: AbstractElem2, str: LineWrapper): true | undefined {
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
