import { afterAll, expect, test } from "vitest";
import { importCases } from "../../../shared-tests/src/test-cases/LegacyImportCases.js"

import { ModuleRegistry } from "../ModuleRegistry.js";
import { trimSrc } from "./shared/StringUtil.js";

interface LinkExpectation {
  includes?: string[];
  excludes?: string[];
  linked?: string;
}

// wgsl example src, indexed by name
const examplesByName = new Map(importCases.map((t) => [t.name, t.src]));

test.skip('import { foo } from "./bar";', (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() {
        foo();
      }

      fn foo() { }
    `,
  });
});

test.skip(`import { foo, boo } from "./bar";`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() {
        foo();
        boo();
      }

      fn foo() { }

      fn boo() { }
    `,
  });
});

test.skip(`import foo, boo from ./bar`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() {
        foo();
        boo();
      }

      fn foo() { }

      fn boo() { }
    `,
  });
});

test.skip(`import bar::foo`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() { foo(); }

      fn foo() { }
    `,
  });
});

test.skip(`import self::foo::bar`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() { bar(); }

      fn bar() { }
    `,
  });
});

test.skip(`import bar::{foo as zip}`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() { zip(); }

      fn zip() { }
    `,
  });
});

test.skip(`call foo::bar()`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() { bar(); }

      fn bar() { }
    `,
  });
});

test.skip(`import foo::bar; var x:bar;`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      var x: bar;

      fn main() { }

      struct bar {
        f: f32
      }
    `,
  });
});

test.skip(`var y: foo::bar;`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      var y: bar;

      fn main() { }

      struct bar {
        f: f32
      }
    `,
  });
});

test.skip(`import foo::{bar, zah}`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() { bar(); zah(); }

      fn bar() { }

      fn zah() { }
    `,
  });
});

test.skip(`import foo::{bar::jan::zah, doo}`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() { zah(); doo(); }

      fn zah() { }

      fn doo() { }
    `,
  });
});

test.skip(`import foo::*`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() { bar(); zah(); }

      fn bar() { }

      fn zah() { }
    `,
  });
});

test.skip(`import both rust and js style`, (ctx) => {
  linkTest(ctx.task.name, {
    linked: `
      fn main() { zah(); doo(); }

      fn zah() { }

      fn doo() { }
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
    expect(result).eq(expectTrimmed);
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
