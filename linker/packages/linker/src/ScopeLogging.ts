import { dlog, pretty } from "berry-pretty";
import { Scope } from "./Scope.ts";

export function logScope(message: string, scope: Scope) {
  console.log(`${message}:`);
  console.log(scopeToString(scope, 2));
}

export function scopeToString(scope: Scope, indent = 0): string {
  const { children, parent } = scope;
  const childStrings = children.map(c => scopeToString(c, indent + 4));
  const childrenStr = childStrings.join("\n");
  const spc = " ".repeat(indent);
  // prettier-ignore
  return `${spc}${scopeHeader(scope)}\n` + 
         `${spc}  parent: ${scopeHeader(parent)}\n` +
         `${spc}  children:\n`+ 
         `${childrenStr}`;
}

/** A debugging print of the scope tree with identifiers in nested brackets */
export function scopeIdentTree(scope: Scope, indent = 0): string {
  const { children } = scope;
  let childStrings: string[] = [];
  if (children.length)
    childStrings = children.map(c => scopeIdentTree(c, indent + 2));

  // list of identifiers, with decls prefixed with '%'
  const identStr = scope.idents
    .map(({ kind, originalName }) => {
      const prefix = kind === "decl" ? "%" : "";
      return `${prefix}${originalName}`;
    })
    .join(", ");
  const spc = " ".repeat(indent);
  if (children.length === 0) {
    return `${spc}{ ${identStr} }`;
  } else {
    const lines = [`${spc}{ ${identStr}`, ...childStrings, `${spc}}`];
    return lines.join("\n");
  }
}

function scopeHeader(scope: Scope | undefined | null): string {
  if (scope === undefined) {
    return "undefined";
  }
  if (scope === null) {
    return "null";
  }

  const { kind, idents, id } = scope;
  const identStr = pretty(idents.map(i => i.originalName));
  const idStr = "id: " + id === undefined ? "?" : id;
  return `#${idStr} ${kind} ${identStr}`;
}
