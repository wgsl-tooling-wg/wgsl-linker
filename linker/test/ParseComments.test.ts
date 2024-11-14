import { preParse } from "@wesl/mini-parse";
import { expectNoLogErr } from "@wesl/mini-parse/test-util";

import { expect, test } from "vitest";
import { assertSnapshot } from "@std/testing/snapshot";
import { blockComment, comment, lineComment } from "../ParseSupport.ts";
import { parseWgslD } from "../ParseWgslD.ts";
import { testAppParse } from "./TestUtil.ts";

test("lineComment parse // foo bar", () => {
  const src = "// foo bar";
  const { position } = testAppParse(lineComment, src);
  expect(position).toBe(src.length);
});

test("lineComment parse // foo bar \\n", () => {
  const src = "// foo bar\n";
  const { position } = testAppParse(lineComment, src);
  expect(position).toBe(src.length);
});

test("blockComment parses /* comment */", async (ctx) => {
  const src = "/* comment */";
  await expectNoLogErr(async () => {
    const { parsed } = testAppParse(blockComment, src);
    await assertSnapshot(ctx, parsed);
  });
});

test("skipBlockComment parses nested comment", () => {
  const src = "/** comment1 /* comment2 */ */";
  expectNoLogErr(() => {
    testAppParse(blockComment, src);
  });
});

test("parse fn with line comment", async (ctx) => {
  const src = `
    fn binaryOp() { // binOpImpl
    }`;
  const parsed = parseWgslD(src);
  await assertSnapshot(ctx, parsed);
});

test.ignore("wordNumArgs parses (a, b, 1) with line comments everywhere", async (ctx) => {
  const src = `(
    // aah
    a, 
    // boh
    b, 
    // oneness
    1
    // satsified
    )`;
  // const { parsed } = testAppParse(preParse(comment, ), src);
  // await assertSnapshot(ctx, parsed?.value);
});

test("parse empty line comment", () => {
  const src = `
  var workgroupThreads= 4;                          // 
  `;
  expectNoLogErr(() => parseWgslD(src));
});

test.ignore("parse line comment with #replace", () => {
  const src = ` 
  const workgroupThreads= 4;                          // #replace 4=workgroupThreads
  `;
  expectNoLogErr(() => parseWgslD(src));
});
