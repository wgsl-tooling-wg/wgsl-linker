import { pretty } from "berry-pretty";
import { LineWrapper } from "./LineWrapper.ts";
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
  const identStrings = scope.idents.map(({ kind, originalName }) => {
    const prefix = kind === "decl" ? "%" : "";
    return `${prefix}${originalName}`;
  });

  const str = new LineWrapper(indent);
  str.add("{ ");

  const last = identStrings.length - 1;
  identStrings.forEach((s, i) => {
    const element = i < last ? s + ", " : s;
    str.add(element);
  });

  if (childStrings.length) {
    str.nl();
    str.addBlock(childStrings.join("\n"));
  }

  if (str.oneLine) {
    str.add(" }");
  } else {
    if (!childStrings.length) str.nl();
    str.add("}");
  }

  return str.result;
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
