import { ImportTree, PathSegment, SegmentList, SimpleSegment } from "../ImportTree.ts";

export function importToString(tree: ImportTree): string {
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
    return `(${importToString(segment)})`;
  }
  return `|unknown segment type ${(segment as any).constructor.name}|`;
}
