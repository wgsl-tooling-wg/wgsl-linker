import { _withBaseLogger } from "@wesl/mini-parse";
import { logCatch } from "@wesl/mini-parse/test-util";
import { expect, test } from "vitest";
import { assertSnapshot } from "@std/testing/snapshot";
import { parseModule, TextModule } from "../ParseModule.ts";
import { simpleTemplate } from "../templates/SimpleTemplate.ts";

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

test.ignore("match #extends", () => {
  const src = `
    // #extends Foo from pkg
    // #extends Bar from pkg
    struct Elem {
      sum: f32
    }
  `;
  const module = testParseModule(src);
  const merges = module.structs[0].extendsElems!;
  expect(merges[0].name).toBe("Foo");
  expect(merges[1].name).toBe("Bar");
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

test.ignore("simple #template preserves src map", () => {
  const src = `
    #template simple
    fn foo() { XX }
  `;
  const expected = `
    fn foo() { /**/ }
  `;
  const templates = new Map([["simple", simpleTemplate.apply]]);
  const textModule = parseModule(src, "./foo", { XX: "/**/" }, templates);
  expect(textModule.preppedSrc).toContain("fn foo() { /**/ }");
  expect(textModule.preppedSrc).toBe(expected);
  expect(textModule.srcMap.entries.length).toBe(3);
});

test.ignore(
  "parse error shows correct line after simple #template",
  async (ctx) => {
    const src = `
    #template simple
    fn foo () { XX }
    fn () { } // oops
  `;
    const templates = new Map([["simple", simpleTemplate.apply]]);
    const { log, logged } = logCatch();
    _withBaseLogger(log, () => {
      parseModule(src, "./foo", { XX: "/**/" }, templates);
    });
    await assertSnapshot(ctx, logged());
  }
);

test("parse error shows correct line after #ifdef ", async (ctx) => {
  const src = `
    // #if FALSE
    foo
    bar
    // #endif
    fn () { } // oops
  `;
  const templates = new Map([["simple", simpleTemplate.apply]]);
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    parseModule(src, "./foo", { XX: "/**/" }, templates);
  });
  await assertSnapshot(ctx, logged());
});

test("parse error shows correct line after #ifdef and simple #template", async (ctx) => {
  const src = `
    // #if FALSE
    foo
    bar
    // #endif
    // #template simple
    fn foo () { XX }
    fn () { } // oops
  `;
  const templates = new Map([["simple", simpleTemplate.apply]]);
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => {
    parseModule(src, "./foo", { XX: "/**/" }, templates);
  });
  await assertSnapshot(ctx, logged());
});

test("import gleam style", async (ctx) => {
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
