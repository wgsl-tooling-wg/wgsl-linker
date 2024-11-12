import { expect, test } from "vitest";
import { srcLine, srcLog } from "../ParserLogging.js";
import { _withBaseLogger } from "../ParserTracing.js";
import { logCatch } from "../test-util/LogCatcher.js";

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

test("srcLog", () => {
  const src = `a\n12345\nb`;

  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    srcLog(src, 5, "uh-oh:");
  });
  expect(logged()).toMatchInlineSnapshot(`
    "uh-oh:
    12345   Ln 2
       ^"
  `);
});

test("srcLog on longer example", () => {
  const src = `
    #export(C, D) /*            */
    fn foo(c:C, d:D) { support(d); } 
    
    fn support(d:D) { bar(d); }
    `;
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    srcLog(src, 101, "ugh:");
  });
  expect(logged()).toMatchInlineSnapshot(`
    "ugh:
        fn support(d:D) { bar(d); }   Ln 5
                          ^"
  `);
});

test("srcLog with two carets", () => {
  const src = `a\n12345\nb`;

  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    srcLog(src, [2, 7], "found:");
  });
  expect(logged()).toMatchInlineSnapshot(`
    "found:
    12345   Ln 2
    ^    ^"
  `);
});
