import { expect, test } from "vitest";
import { assertSnapshot } from "@std/testing/snapshot";
import { SrcMap } from "../SrcMap.ts";

test("compact", async (ctx) => {
  const src = "a b";
  const dest = "|" + src + " d";

  const srcMap = new SrcMap(dest);
  srcMap.addEntries([
    { src, srcStart: 0, srcEnd: 2, destStart: 1, destEnd: 3 },
    { src, srcStart: 2, srcEnd: 3, destStart: 3, destEnd: 4 },
  ]);
  srcMap.compact();
  await assertSnapshot(ctx, srcMap.entries);
});

test("merge", async (ctx) => {
  const src = "a b";
  const src2 = "d";
  const mid = "|" + src + " " + src2;
  const dest = "xx" + mid + " z";
  /*
    mid:
      01234567890
      |a b d
    dest:
      01234567890
      xx|a b d z
  */

  const map1 = new SrcMap(mid, [
    { src, srcStart: 0, srcEnd: 3, destStart: 1, destEnd: 4 },
  ]);

  const map2 = new SrcMap(dest, [
    { src: mid, srcStart: 1, srcEnd: 4, destStart: 3, destEnd: 6 },
    { src: src2, srcStart: 0, srcEnd: 1, destStart: 8, destEnd: 9 },
  ]);

  const merged = map1.merge(map2);
  await assertSnapshot(ctx, merged.entries);
});
