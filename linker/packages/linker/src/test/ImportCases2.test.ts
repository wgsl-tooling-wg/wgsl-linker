import { afterAll, expect, test } from "vitest";
import { importCases } from "wesl-testsuite";
import { linkWeslFiles } from "../Linker2.js";
import { matchTrimmed, trimSrc } from "./shared/StringUtil.js";

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

test("main has other root elements", ctx => {
  linkTest2(ctx.task.name, {
    linked: `
      struct Uniforms {
        a: u32
      }

      @group(0) @binding(0) var<uniform> u: Uniforms;

      fn main() { }
    `,
  });
});

test("import foo as bar", ctx => {
  linkTest2(ctx.task.name, {
    linked: `
      fn main() {
        bar();
      }

      fn bar() { /* fooImpl */ }
    `,
  });
});

test("import twice doesn't get two copies", ctx => {
  linkTest2(ctx.task.name, {
    linked: `
      fn main() {
        foo();
        bar();
      }

      fn foo() { /* fooImpl */ }

      fn bar() { foo(); }
    `,
  });
});

test("imported fn calls support fn with root conflict", ctx => {
  linkTest2(ctx.task.name, {
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
});

test("import twice with two as names", ctx => {
  linkTest2(ctx.task.name, {
    linked: `
      fn main() { bar(); bar(); }

      fn bar() { }
    `,
  });
});

test("import transitive conflicts with main", ctx => {
  linkTest2(ctx.task.name, {
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
});

test("multiple exports from the same module", ctx => {
  linkTest2(ctx.task.name, {
    linked: `
      fn main() {
        foo();
        bar();
      }

      fn foo() { }

      fn bar() { }
    `,
  });
});

test.skip("import and resolve conflicting support function", ctx => {
  linkTest2(ctx.task.name, {
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
});

test.skip("import support fn that references another import", ctx => {
  linkTest2(ctx.task.name, {
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
});

test("import support fn from two exports", ctx => {
  linkTest2(ctx.task.name, {
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
});

test("import a struct", ctx => {
  linkTest2(ctx.task.name, {
    linked: `
      fn main() {
        let a = AStruct(1u);
      }

      struct AStruct {
        x: u32,
      }
    `,
  });
});

test("struct referenced by a fn param", ctx => {
  linkTest2(ctx.task.name, {
    linked: `
        fn main() { foo(); }

        fn foo(a: AStruct) { 
          let b = a.x;
        }

        struct AStruct {
          x: u32
        }
    `,
  });
});

test("import fn with support struct constructor", ctx => {
  linkTest2(ctx.task.name, {
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
});

test.skip("import a transitive struct", ctx => {
  linkTest2(ctx.task.name, {
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
});

test("'import as' a struct", ctx => {
  linkTest2(ctx.task.name, {
    linked: `
      fn foo (a: AA) { }

      struct AA { x: u32 }
    `,
  });
});

test.skip("import a struct with name conflicting support struct", ctx => {
  linkTest2(ctx.task.name, {
    linked: `
      struct Base {
        b: i32
      }

      fn foo() -> AStruct {var a:AStruct; return a;}

      struct AStruct {
        x: Base0
      }

      struct Base0 {
        x: u32
      }
    `,
  });
});

test("copy alias to output", ctx => {
  linkTest2(ctx.task.name, {
    linked: `
      alias MyType = u32;
    `,
  });
});

test("copy diagnostics to output", ctx => {
  linkTest2(ctx.task.name, {
    linked: `
      diagnostic(off,derivative_uniformity);
    `,
  });
});

// TODO add case for const_assert in non root module
// TODO add case for diagnostic in non-root module (should fail?)

afterAll(c => {
  const testNameSet = new Set(c.tasks.map(t => t.name));
  const cases = importCases.map(c => c.name);
  const missing = cases.filter(name => !testNameSet.has(name));
  if (missing.length) {
    console.error("Missing tests for cases:", missing);
    expect("missing test: " + missing.toString()).toBe("");
  }
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
    matchTrimmed(result, linked);
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
