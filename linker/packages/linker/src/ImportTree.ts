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
