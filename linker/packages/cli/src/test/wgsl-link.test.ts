import { expect, test, vi } from "vitest";
import { cli } from "../cli.js";

/** so vitest triggers when these files change */
import("./src/test/wgsl/main.wgsl?raw");
import("./src/test/wgsl/util.wgsl?raw");

test("simple link", async () => {
  const logged = await cliLine(
    `./src/test/wgsl/main.wgsl 
     ./src/test/wgsl/util.wgsl 
     --baseDir ./src/test/wgsl`,
  );
  expect(logged).toMatchInlineSnapshot(`
    "
    fn main() {
      foo();
    }

    // TBD
    // @if EXTRA 
    // fn extra() { }


    fn foo() {
      // fooImpl
    }"
  `);
});

test("ast link", async () => {
  const line = `./src/test/wgsl/main.wgsl 
     ./src/test/wgsl/util.wgsl 
     --baseDir ./src/test/wgsl 
     --details 
     --emit false`;

  const logged = await cliLine(line);
  expect(logged).toMatchInlineSnapshot(`
    "---
    package::main

    ->ast
    module
      import package/util/foo
        text 'import ./util/foo;
    '
      text '
    '
      fn main()
        text 'fn '
        decl %main
        text '() {
      '
        ref foo
        text '();
    }'
      text '

    // TBD
    // @if EXTRA 
    // fn extra() { }
    '

    ->scope
    { %main
      { foo }
    }

    ---
    package::util

    ->ast
    module
      fn foo()
        text 'fn '
        decl %foo
        text '() {
      // fooImpl
    }'

    ->scope
    { %foo
      {  }
    }
    "
  `);
});

test.skip("link with definition", async () => {
  const logged = await cliLine(
    `./src/test/wgsl/main.wgsl 
       ./src/test/wgsl/util.wgsl
       --define EXTRA=true`,
  );
  expect(logged).toContain("fn extra()");
});

async function cliLine(argsLine: string): Promise<string> {
  return await withConsoleSpy(() => cli(argsLine.split(/\s+/)));
}

async function withConsoleSpy(fn: () => Promise<void>): Promise<string> {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  try {
    await fn();
  } finally {
    const log = consoleSpy.mock.calls.join("\n");
    vi.restoreAllMocks();
    return log;
  }
}
