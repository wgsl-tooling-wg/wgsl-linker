import { Parser } from "mini-parse";

type AnyParser = Parser<any, any>;

export function printParser(p: AnyParser): void {
  fnChildrenDeep(p);
  printDeep(p, 0, new Set());
}

function printDeep(
  p: AnyParser,
  indent: number,
  visited: Set<AnyParser>,
): void {
  const pad = " ".repeat(indent);
  if (visited.has(p)) {
    console.log(pad + "->" + p.debugName);
    return;
  } else {
    visited.add(p);
  }
  console.log(pad + p.debugName);
  p._children?.forEach(c => printDeep(c, indent + 2, visited));
}

function fnChildrenDeep(p: AnyParser): void {
  if (p.debugName === "fn()") {
    const newChild = (p as any)._fn() as AnyParser;
    p._children = [newChild];
  } else {
    p._children?.forEach(fnChildrenDeep);
  }
}
