import { expect, test } from "vitest";
import { importCases } from "wesl-testsuite";

import { linkWeslFiles } from "../Linker2.js";
import { trimSrc } from "./shared/StringUtil.js";

interface LinkExpectation {
  includes?: string[];
  excludes?: string[];
  linked?: string;
}

// wgsl example src, indexed by name
const examplesByName = new Map(importCases.map(t => [t.name, t.src]));

test("import ./bar/foo", ctx => {
  linkTest2(ctx.task.name, {
    linked: `
      fn main() {
        foo();
      }

      fn foo() { }
    `,
  });
});

function linkTest2(name: string, expectation: LinkExpectation): void {
  /* -- find and trim source texts -- */
  const exampleSrc = examplesByName.get(name);
  if (!exampleSrc) {
    throw new Error(`Skipping test "${name}"\nNo example found.`);
  }
  const srcs = Object.entries(exampleSrc).map(([name, wgsl]) => {
    const trimmedSrc = trimSrc(wgsl);
    return [name, trimmedSrc] as [string, string];
  });

  const wesl = Object.fromEntries(srcs);

  /* -- link -- */
  const resultMap = linkWeslFiles(wesl, srcs[0][0]);
  const result = resultMap.dest;

  /* -- trim and verify results line by line -- */
  const { linked, includes, excludes } = expectation;
  if (linked !== undefined) {
    const expectTrimmed = trimSrc(linked);
    const resultTrimmed = trimSrc(result);
    if (resultTrimmed !== expectTrimmed) {
      console.log(
        "result:\n",
        resultTrimmed,
        "\n\n...failed. Expected:\n",
        expectTrimmed,
      );
      const expectLines = expectTrimmed.split("\n");
      const resultLines = result.split("\n");
      expectLines.forEach((line, i) => {
        expect(resultLines[i]).toBe(line);
      });
    }
  }
  if (includes !== undefined) {
    includes.forEach(inc => {
      expect(result).toContain(inc);
    });
  }
  if (excludes !== undefined) {
    excludes.forEach(exc => {
      expect(result).not.toContain(exc);
    });
  }
}
