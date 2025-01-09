import { LineWrapper } from "./LineWrapper.ts";
import { Ident, Scope } from "../Scope.ts";

/** A debugging print of the scope tree with identifiers in nested brackets */
export function scopeToString(scope: Scope, indent = 0): string {
  const { children } = scope;
  let childStrings: string[] = [];
  if (children.length)
    childStrings = children.map(c => scopeToString(c, indent + 2));

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

export function identToString(ident?: Ident): string {
  if (!ident) return JSON.stringify(ident);
  const { kind, originalName } = ident;
  const idStr = ident.id ? `#${ident.id}` : "";
  if (kind === "ref") {
    const ref = identToString(ident.refersTo!);
    return `${originalName} ${idStr} -> ${ref}`;
  } else {
    return `%${originalName} ${idStr} (${ident.mangledName})`;
  }
}
