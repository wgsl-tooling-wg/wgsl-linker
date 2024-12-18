import { LineWrapper } from "./LineWrapper.ts";
import { Scope } from "./Scope.ts";

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
