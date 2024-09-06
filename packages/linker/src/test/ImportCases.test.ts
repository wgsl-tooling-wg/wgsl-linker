import { afterAll, expect, test } from "vitest";
import { importCases } from "../../../shared-tests/src/test-cases/ImportCases.js";

import { ModuleRegistry } from "../ModuleRegistry.js";
import { trimSrc } from "./shared/StringUtil.js";

interface LinkExpectation {
  includes?: string[];
  excludes?: string[];
  linked?: string;
}

// wgsl example src, indexed by name
const examplesByName = new Map(importCases.map((t) => [t.name, t.src]));

test("import ./bar/foo", (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() {
        foo();
      }

      fn foo() { }
    `,
  });
});

test("main has other root elements", (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      struct Uniforms {
        a: u32
      }

      @group(0) @binding(0) var<uniform> u: Uniforms;

      fn main() { }
    `,
  });
});

test("import foo as bar", (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() {
        bar();
      }

      fn bar() { /* fooImpl */ }
    `,
  });
});

afterAll((c) => {
  const testNameSet = new Set(c.tasks.map((t) => t.name));
  const cases = importCases.map((c) => c.name);
  const missing = cases.filter((name) => !testNameSet.has(name));
  if (missing.length) {
    console.error("Missing tests for cases:", missing);
    expect("missing test: " + missing.toString()).toBe("");
  }
});

function linkTest(name: string, expectation: LinkExpectation): void {
  const exampleSrc = examplesByName.get(name);
  if (!exampleSrc) {
    throw new Error(`Skipping test "${name}"\nNo example found.`);
  }
  const srcs = Object.entries(exampleSrc).map(([name, wgsl]) => {
    const trimmedSrc = trimSrc(wgsl);
    return [name, trimmedSrc] as [string, string];
  });
  const main = srcs[0][0];
  const wgsl = Object.fromEntries(srcs);
  const registry = new ModuleRegistry({ wgsl });
  const result = registry.link(main);

  const { linked, includes, excludes } = expectation;

  if (linked !== undefined) {
    const expectTrimmed = trimSrc(linked);
    const resultTrimmed = trimSrc(result);
    if (resultTrimmed !== expectTrimmed) {
      const expectLines = expectTrimmed.split("\n");
      const resultLines = result.split("\n");
      expectLines.forEach((line, i) => {
        expect(resultLines[i]).eq(line);
      });
    }
  }
  if (includes !== undefined) {
    includes.forEach((inc) => {
      expect(result).includes(inc);
    });
  }
  if (excludes !== undefined) {
    excludes.forEach((exc) => {
      expect(result).not.includes(exc);
    });
  }
}
