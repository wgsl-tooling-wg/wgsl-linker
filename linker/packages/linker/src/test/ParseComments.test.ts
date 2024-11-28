import { preParse } from "mini-parse";
import { expectNoLogErr } from "mini-parse/test-util";

import { expect, test } from "vitest";
import { lineComment } from "../ParseDirective.js";
import { blockComment, comment } from "../ParseSupport.js";
import { parseWESL } from "../ParseWESL.js";
import { testAppParse } from "./TestUtil.js";

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

test("blockComment parses /* comment */", () => {
  const src = "/* comment */";
  expectNoLogErr(() => {
    const { parsed } = testAppParse(blockComment, src);
    expect(parsed).toMatchSnapshot();
  });
});

test("skipBlockComment parses nested comment", () => {
  const src = "/** comment1 /* comment2 */ */";
  expectNoLogErr(() => {
    testAppParse(blockComment, src);
  });
});

test("parse fn with line comment", () => {
  const src = `
    fn binaryOp() { // binOpImpl
    }`;
  const parsed = parseWESL(src);
  expect(parsed.elems).toMatchSnapshot();
});

test.skip("wordNumArgs parses (a, b, 1) with line comments everywhere", () => {
  const src = `(
    // aah
    a, 
    // boh
    b, 
    // oneness
    1
    // satsified
    )`;
  // const { parsed } = testAppParse(preParse(comment, wordNumArgs), src); // TODO fixme
  // expect(parsed?.value).toMatchSnapshot();
});

test("parse empty line comment", () => {
  const src = `
  var workgroupThreads= 4;                          // 
  `;
  expectNoLogErr(() => parseWESL(src));
});

test.skip("parse line comment with #replace", () => {
  const src = ` 
  const workgroupThreads= 4;                          // #replace 4=workgroupThreads
  `;
  expectNoLogErr(() => parseWESL(src));
});
