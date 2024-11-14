import { expect, test } from "vitest";
import { importCases } from "wesl-testsuite";

import { ModuleRegistry } from "../ModuleRegistry.ts";
import { trimSrc } from "./shared/StringUtil.ts";

interface LinkExpectation {
  includes?: string[];
  excludes?: string[];
  linked?: string;
}

// wgsl example src, indexed by name
const examplesByName = new Map(importCases.map((t) => [t.name, t.src]));
const testNameSet = new Set();

linkTest("import ./bar/foo", {
  linked: `
      fn main() {
        foo();
      }

      fn foo() { }
    `,
});

linkTest("main has other root elements", {
  linked: `
      struct Uniforms {
        a: u32
      }

      @group(0) @binding(0) var<uniform> u: Uniforms;

      fn main() { }
    `,
});

linkTest("import foo as bar", {
  linked: `
      fn main() {
        bar();
      }

      fn bar() { /* fooImpl */ }
    `,
});

linkTest("import twice doesn't get two copies", {
  linked: `
      fn main() {
        foo();
        bar();
      }

      fn foo() { /* fooImpl */ }

      fn bar() { foo(); }
    `,
});

linkTest("imported fn calls support fn with root conflict", {
  linked: `
      fn main() { foo(); }

      fn conflicted() { }

      fn foo() {
        conflicted0(0);
        conflicted0(1);
      }

      fn conflicted0(a:i32) {}
    `,
});

linkTest("import twice with two as names", {
  linked: `
      fn main() { bar(); bar(); }

      fn bar() { }
    `,
});

linkTest("import transitive conflicts with main", {
  linked: `
      fn main() {
        mid();
      }

      fn grand() {
        /* main impl */
      }

      fn mid() { grand0(); }

      fn grand0() { /* grandImpl */ }
    `,
});

linkTest("multiple exports from the same module", {
  linked: `
      fn main() {
        foo();
        bar();
      }

      fn foo() { }

      fn bar() { }
    `,
});

linkTest("import and resolve conflicting support function", {
  linked: `
      fn support() {
        bar();
      }

      fn bar() {
        support0();
      }

      fn support0() { }
    `,
});

linkTest("import support fn that references another import", {
  linked: `
      fn support() {
        foo();
      }

      fn foo() {
        support0();
        bar();
      }

      fn support0() { }

      fn bar() {
        support1();
      }

      fn support1() { }
    `,
});

linkTest("import support fn from two exports", {
  linked: `
      fn main() {
        foo();
        bar();
      }

      fn foo() {
        support();
      }

      fn bar() {
        support();
      }

      fn support() { }
    `,
});

linkTest("import a struct", {
  linked: `
      fn main() {
        let a = AStruct(1u);
      }

      struct AStruct {
        x: u32
      }
    `,
});

linkTest("import fn with support struct constructor", {
  linked: `
      fn main() {
        let ze = elemOne();
      }

      fn elemOne() -> Elem {
        return Elem(1u);
      }

      struct Elem {
        sum: u32
      }
    `,
});

linkTest("import a transitive struct", {
  linked: `
      struct SrcStruct {
        a: AStruct
      }

      struct AStruct {
        s: BStruct
      }

      struct BStruct {
        x: u32
      }
    `,
});

linkTest("'import as' a struct", {
  linked: `
      fn foo (a: AA) { }

      struct AA {
        x: u32
      }
    `,
});

linkTest("import a struct with name conflicting support struct", {
  linked: `
      struct Base {
        b: i32
      }

      fn foo() -> AStruct {let a:AStruct; return a;}

      struct AStruct {
        x: Base0
      }

      struct Base0 {
        x: u32
      }
    `,
});

linkTest("copy alias to output", {
  linked: `
      alias MyType = u32;
    `,
});

linkTest("copy diagnostics to output", {
  linked: `
      diagnostic(off,derivative_uniformity);
    `,
});

function linkTest(name: string, expectation: LinkExpectation): void {
  testNameSet.add(name);
  test(name, () => {
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
          expect(resultLines[i]).toBe(line);
        });
      }
    }
    if (includes !== undefined) {
      includes.forEach((inc) => {
        expect(result).toContain(inc);
      });
    }
    if (excludes !== undefined) {
      excludes.forEach((exc) => {
        expect(result).not.toContain(exc);
      });
    }
  });
}

(() => {
  const cases = importCases.map((c) => c.name);
  const missing = cases.filter((name) => !testNameSet.has(name));
  if (missing.length > 0) {
    console.error("Missing tests for cases:", missing);
    expect("missing test: " + missing.toString()).toBe("");
  }
});
