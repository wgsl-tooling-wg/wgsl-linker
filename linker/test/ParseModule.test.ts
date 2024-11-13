import { expect, test } from "vitest";
import { assertSnapshot } from "@std/testing/snapshot";
import { parseModule, TextModule } from "../ParseModule.ts";

test("simple fn export", async (ctx) => {
  const src = `
    export
    fn one() -> i32 {
      return 1;
    }
  `;
  const module = testParseModule(src);
  expect(module.exports.length).toBe(1);
  await assertSnapshot(ctx, module);
});

test("simple fn import", async (ctx) => {
  const src = `
    import bar/foo

    fn bar() { foo(); }
  `;
  const module = testParseModule(src);
  expect(module.imports.length).toBe(1);
  await assertSnapshot(ctx, module);
});

test("read simple struct export", () => {
  const exportPrefix = `export`;
  const src = `
    struct Elem {
      sum: f32
    }
  `;
  const module = testParseModule(exportPrefix + "\n" + src);
  expect(module.exports.length).toBe(1);
  const firstExport = module.exports[0];
  expect(firstExport.ref.name).toBe("Elem");
});

test("read #module", () => {
  const src = `
    module my.module.com
    export fn foo() {}
  `;
  const textModule = testParseModule(src);
  expect(textModule.modulePath).toBe("my.module.com");
});

// test.skip("parse error shows correct line after @if", () => {});

test("import gleam style", () => {
  const src = `
    import my/foo

    fn bar() { foo(); }
  `;
  const module = testParseModule(src);
  await assertSnapshot(ctx, module.imports);
});

function testParseModule(src: string): TextModule {
  return parseModule(src, "./test.wgsl");
}
