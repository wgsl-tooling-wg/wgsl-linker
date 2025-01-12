import {
  AttributeElem,
  ExpressionElem,
  TypeRefElem,
  TypeTemplateParameter,
} from "./AbstractElems.ts";
import { findDecl } from "./LowerAndEmit.ts";
import { RefIdent } from "./Scope.ts";

// LATER DRY emitting elements like this with LowerAndEmit?

export function attributeToString(attribute: AttributeElem): string {
  const params =
    attribute.params ?
      `(${attribute.params.map(expressionToString).join(", ")})`
    : "";
  return `@${attribute.name}${params}`;
}

export function typeListToString(params: TypeTemplateParameter[]): string {
  return `<${params.map(typeParamToString).join(", ")}>`;
}

export function typeParamToString(param?: TypeTemplateParameter): string {
  if (typeof param === "string") return param;
  if (param?.kind === "expression") return expressionToString(param);
  if (param?.kind === "type") return typeRefToString(param);
  else return `?${param}?`;
}

function typeRefToString(t?: TypeRefElem): string {
  if (!t) return "?";
  const { name, templateParams } = t;
  const params = templateParams ? typeListToString(templateParams) : "";
  return `${refToString(name)}${params}`;
}

function refToString(ref: RefIdent | string): string {
  if (typeof ref === "string") return ref;
  if (ref.std) return ref.originalName;
  const decl = findDecl(ref);
  return decl.mangledName || decl.originalName;
}

function expressionToString(elem: ExpressionElem): string {
  const parts = elem.contents.map(c => {
    if (c.kind === "text") {
      return c.srcModule.src.slice(c.start, c.end);
    } else {
      return `?${c.kind}?`;
    }
  });
  return parts.join(" ");
}
