import { expect, test } from "vitest";
import {
  ImportTree,
  SegmentList,
  SimpleSegment,
  treeToString,
} from "../ImportTree.ts";
import { flattenTreeImport } from "../FlattenTreeImport.ts";

test("complex tree import", () => {
  const zap = new SimpleSegment("zap");
  const foo = new SimpleSegment("foo", "bar"); // foo as bar
  const doh = new SimpleSegment("doh");
  const bib = new SimpleSegment("bib");
  const bog = new SimpleSegment("bog");
  const subtree = new ImportTree([bib, bog]);
  const list = new SegmentList([foo, doh, subtree]);

  const tree = new ImportTree([zap, list]);
  const flattened = flattenTreeImport(tree);
  expect(flattened).toMatchInlineSnapshot(`
    [
      {
        "importPath": [
          "zap",
          "bar",
        ],
        "modulePath": [
          "zap",
          "foo",
        ],
      },
      {
        "importPath": [
          "zap",
          "doh",
        ],
        "modulePath": [
          "zap",
          "doh",
        ],
      },
      {
        "importPath": [
          "zap",
          "bib",
          "bog",
        ],
        "modulePath": [
          "zap",
          "bib",
          "bog",
        ],
      },
    ]
  `);
});
