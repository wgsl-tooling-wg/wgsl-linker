import { Parser } from "mini-parse";

type AnyParser = Parser<any, any>;

export function parserToString(p: AnyParser): string {
  fnChildrenDeep(p, new Set());
  return deepToString(p, 0, new Set());
}

function deepToString(
  p: AnyParser,
  indent: number,
  visited: Set<AnyParser>,
): string {
  const lines:string[] = [];
  const pad = " ".repeat(indent);
  if (visited.has(p)) {
    lines.push(pad + "->" + p.debugName + "\n");
    // console.log(pad + "->" + p.debugName);
  } else {
    visited.add(p);
    lines.push(pad + p.debugName);
    const childBlock = p._children
      ?.map(c => deepToString(c, indent + 2, visited))
      .join("");
    lines.push(childBlock || "");
  }
  return lines.join("\n");
}

/** fill in the _children field in fn() parsers,
 * (since fn() parsers defer evaluation of their arguments, _children
 * isn't known) */
function fnChildrenDeep(p: AnyParser, visited: Set<AnyParser>): void {
  if (!visited.has(p)) {
    visited.add(p);
    if (p.debugName === "fn()") {
      const newChild = (p as any)._fn() as AnyParser;
      p._children = [newChild];
    }
    p._children?.forEach(c => fnChildrenDeep(c, visited));
  }
}
