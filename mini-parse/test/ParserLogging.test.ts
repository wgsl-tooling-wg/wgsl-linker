import { expect, test } from "vitest";
import { assertSnapshot } from "@std/testing/snapshot";
import { srcLine, srcLog } from "../ParserLogging.ts";
import { _withBaseLogger } from "../ParserTracing.ts";
import { logCatch } from "../test-util/LogCatcher.ts";

test("srcLine", () => {
  const src1 = "1";
  const src2 = "line 2";
  const src3 = " line 3";
  const src = [src1, src2, src3].join("\n");

  const { line: line1 } = srcLine(src, 0);
  expect(line1).toBe(src1);

  const { line: line4 } = srcLine(src, 1);
  expect(line4).toBe(src1);

  const { line: line5 } = srcLine(src, 2);
  expect(line5).toBe(src2);

  const { line: line2 } = srcLine(src, 3);
  expect(line2).toBe(src2);

  const { line: line3 } = srcLine(src, 100);
  expect(line3).toBe(src3);
});

test("srcLog", async (ctx) => {
  const src = `a\n12345\nb`;

  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    srcLog(src, 5, "uh-oh:");
  });
  await assertSnapshot(ctx, logged());
});

test("srcLog on longer example", async (ctx) => {
  const src = `
    #export(C, D) /*            */
    fn foo(c:C, d:D) { support(d); } 
    
    fn support(d:D) { bar(d); }
    `;
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    srcLog(src, 101, "ugh:");
  });
  await assertSnapshot(ctx, logged());
});

test("srcLog with two carets", async (ctx) => {
  const src = `a\n12345\nb`;

  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    srcLog(src, [2, 7], "found:");
  });
  await assertSnapshot(ctx, logged());
});
