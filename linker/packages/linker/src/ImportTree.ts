export class ImportTree {
  /** segments in path order */
  constructor(public segments: PathSegment[]) {}
}

export type PathSegment = SimpleSegment | ImportTree | SegmentList;

export class SimpleSegment {
  constructor(
    public name: string,
    public as?: string,
    public args?: string[], // generic args (only allowed on final segment). TODO drop
  ) {}
}

/** or choices for this path segment */
export class SegmentList {
  constructor(public list: PathSegment[]) {}
}

export function treeToString(tree: ImportTree): string {
  return tree.segments.map(s => segmentToString(s)).join("/");
}

function segmentToString(segment: PathSegment): string {
  if (segment instanceof SimpleSegment) {
    const { name, as, args } = segment;
    const asMsg = as ? ` as ${as}` : "";
    const argsMsg = args ? `(${args.join(", ")})` : "";
    return `${name}${argsMsg}${asMsg}`;
  }
  if (segment instanceof SegmentList) {
    return `{${segment.list.map(s => segmentToString(s)).join(", ")}}`;
  }
  if (segment instanceof ImportTree) {
    return `(${treeToString(segment)})`;
  }
  return `|unknown segment type ${(segment as any).constructor.name}|`;
}
