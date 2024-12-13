import { Parser } from "mini-parse";

type AnyParser = Parser<any, any>;

export function printParser(p: AnyParser): void {
  printDeep(p, 0);
}

function printDeep(p: AnyParser, indent: number): void {
  const pad = " ".repeat(indent);
  console.log(pad + p.debugName);
  p._children?.forEach(c => printDeep(c, indent + 2));
}
