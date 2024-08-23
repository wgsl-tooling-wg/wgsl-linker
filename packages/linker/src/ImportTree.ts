export class ImportTree {
  constructor(public segments: PathSegment[]) {}
}

export type PathSegment = SimpleSegment | Wildcard | ImportTree | SegmentList;

export class SimpleSegment {
  constructor(
    public name: string,
    public as?: string,
    public args?: string[] // generic args (only allowed on final segment)
  ) {}
}

export class SegmentList {
  constructor(public list: PathSegment[]) {}
}

export class Wildcard {
  constructor(public as?: string) {}
}

export function treeToString(tree: ImportTree): string {
  return tree.segments.map((s) => segmentToString(s)).join("/");
}

function segmentToString(segment: PathSegment): string {
  if (segment instanceof SimpleSegment) {
    const { name, as, args } = segment;
    const asMsg = as ? ` as ${as}` : "";
    const argsMsg = args ? `(${args.join(", ")})` : "";
    return `${name}${argsMsg}${asMsg}`;
  }
  if (segment instanceof Wildcard) {
    return "*";
  }
  if (segment instanceof SegmentList) {
    return `{${segment.list.map((s) => segmentToString(s)).join(", ")}}`;
  }
  if (segment instanceof ImportTree) {
    return `(${treeToString(segment)})`;
  }
  throw new Error(`unknown segment type ${segment}`);
}
