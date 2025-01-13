import {
  AbstractElem,
  ExpressionElem,
  ModuleElem,
  TypeRefElem,
  TypeTemplateParameter,
} from "../AbstractElems.ts";
import { importToString } from "./ImportToString.ts";
import { LineWrapper } from "./LineWrapper.ts";

const maxLineLength = 150;

export function astToString(elem: AbstractElem, indent = 0): string {
  const { kind, contents } = elem as ModuleElem;
  const str = new LineWrapper(indent, maxLineLength);
  str.add(kind);
  addElemFields(elem, str);
  let childStrings: string[] = [];
  if (contents) {
    childStrings = contents.map(e => astToString(e, indent + 2));
  }
  if (childStrings.length) {
    str.nl();
    str.addBlock(childStrings.join("\n"), false);
  }

  return str.result;
}

// TODO DRY with above
export function elemToString(elem: AbstractElem): string {
  const { kind } = elem as ModuleElem;
  const str = new LineWrapper(0, maxLineLength);
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
    addStructMemberFields(elem, str) ||
    addNameFields(elem, str) ||
    addMemberRef(elem, str) ||
    addFnFields(elem, str) ||
    addAliasFields(elem, str) ||
    addAttributeFields(elem, str) ||
    addExpressionFields(elem, str) ||
    addTypeRefFields(elem, str) ||
    addSynthetic(elem, str) ||
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
    const { name, typeRef } = elem;
    str.add(" " + name.ident.originalName);
    if (typeRef) {
      str.add(":" + typeRefElemToString(typeRef));
    }
    return true;
  }
}

function addTextFields(elem: AbstractElem, str: LineWrapper): true | undefined {
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

function addMemberRef(elem: AbstractElem, str: LineWrapper): true | undefined {
  if (elem.kind === "memberRef") {
    str.add(` ${elem.name.ident.originalName}.${elem.member.name}`);
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
    str.add("=" + typeRefElemToString(typeRef));
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

function addStructMemberFields(
  elem: AbstractElem,
  str: LineWrapper,
): true | undefined {
  if (elem.kind === "member") {
    const { name, typeRef, attributes } = elem;
    if (attributes) {
      str.add(" " + attributes.map(a => "@" + (a && a.name)).join(" "));
    }
    str.add(" " + name.name);
    str.add(": " + typeRefElemToString(typeRef));
    return true;
  }
}

function addImport(elem: AbstractElem, str: LineWrapper): true | undefined {
  if (elem.kind === "import") {
    str.add(" " + importToString(elem.imports));
    return true;
  }
}

function addSynthetic(elem: AbstractElem, str: LineWrapper): true | undefined {
  if (elem.kind === "synthetic") {
    str.add(` '${elem.text}'`);
    return true;
  }
}

function addAttributeFields(
  elem: AbstractElem,
  str: LineWrapper,
): true | undefined {
  if (elem.kind === "attribute") {
    const { name, params } = elem;
    str.add(" @" + name);
    if (params) {
      str.add("(");
      str.add(params.map(expressionToString).join(", "));
      str.add(")");
    }
    return true;
  }
}

function addNameFields(elem: AbstractElem, str: LineWrapper): true | undefined {
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
      .map(
        p => p.name.ident.originalName + ": " + typeRefElemToString(p.typeRef),
      )
      .join(", ");
    str.add(paramStrs);
    str.add(")");

    if (returnType) {
      str.add(" -> " + typeRefElemToString(returnType));
    }

    return true;
  }
}

function addTypeRefFields(
  elem: AbstractElem,
  str: LineWrapper,
): true | undefined {
  if (elem.kind === "type") {
    const { name } = elem;
    const nameStr = typeof name === "string" ? name : name.originalName;
    str.add(" " + nameStr);

    if (elem.templateParams !== undefined) {
      const paramStrs = elem.templateParams
        .map(templateParamToString)
        .join(", ");
      str.add("<" + paramStrs + ">");
    }
    return true;
  }
}
function addExpressionFields(
  elem: AbstractElem,
  str: LineWrapper,
): true | undefined {
  if (elem.kind === "expression") {
    const contents = elem.contents
      .map(e => {
        if (e.kind === "text") {
          return "'" + e.srcModule.src.slice(e.start, e.end) + "'";
        } else {
          return elemToString(e);
        }
      })
      .join(" ");
    str.add(" " + contents);
    return true;
  }
}

function expressionToString(elem: ExpressionElem): string {
  const contents = elem.contents
    .map(e => {
      if (e.kind === "text") {
        return "'" + e.srcModule.src.slice(e.start, e.end) + "'";
      } else {
        return elemToString(e);
      }
    })
    .join(" ");
  return contents;
}

function templateParamToString(p: TypeTemplateParameter): string {
  if (typeof p === "string") {
    return p;
  } else if (p.kind === "type") {
    return typeRefElemToString(p);
  } else if (p.kind === "expression") {
    return expressionToString(p);
  } else {
    console.log("unknown template parameter type", p);
    return "??";
  }
}

function typeRefElemToString(elem: TypeRefElem): string {
  if (!elem) return "?type?";
  const { name } = elem;
  const nameStr = typeof name === "string" ? name : name.originalName;

  let params = "";
  if (elem.templateParams !== undefined) {
    const paramStrs = elem.templateParams.map(templateParamToString).join(", ");
    params = "<" + paramStrs + ">";
  }
  return nameStr + params;
}
