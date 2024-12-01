import { expect, test } from "vitest";
import { parseWESL } from "../ParseWESL.ts";
import { scopeIdentTree } from "../ScopeLogging.ts";

test("scope from simple fn", () => {
  const src = `
    fn main() {
      var x: i32 = 1;
    }     `;
  const result = parseWESL(src);
  const { scope } = result;
  const scopeIdents = scope.idents.map(i => i.originalName);
  expect(scopeIdents).toEqual(["main"]);
  expect(scope.children.length).toBe(1);
  const firstChildIdents = scope.children[0].idents.map(i => i.originalName);
  expect(firstChildIdents).toEqual(["x", "i32"]);
});

test("scope from fn with reference", () => {
  const src = `
    fn main() {
      var x: i32 = 1;
      x++;
    }
  `;
  const result = parseWESL(src);
  const { scope } = result;
  const scopeIdents = scope.idents.map(i => i.originalName);
  expect(scopeIdents).toEqual(["main"]);
  const firstChildIdents = scope.children[0].idents.map(i => i.originalName);
  expect(firstChildIdents).toEqual(["x", "i32", "x"]);
});

test("two fns", () => {
  const src = `
    fn foo() {}
    fn bar() {}
  `;
  const result = parseWESL(src);
  const { scope } = result;
  const scopeIdents = scope.idents.map(i => i.originalName);
  expect(scopeIdents).toEqual(["foo", "bar"]);
});

test("two fns, one with a decl", () => {
  const src = `
    fn foo() {
      var a:u32;
    }
    fn bar() {}
  `;
  const result = parseWESL(src);
  const { scope } = result;
  const scopeIdents = scope.idents.map(i => i.originalName);
  expect(scopeIdents).toEqual(["foo", "bar"]);
});

test("fn ref", () => {
  const src = `
    fn foo() {
      bar();
    }
    fn bar() {}
  `;
  const result = parseWESL(src);
  const { children } = result.scope;
  expect(children.length).toBe(2);
  const firstChildIdents = children[0].idents.map(i => i.originalName);
  expect(firstChildIdents).toEqual(["bar"]);
});

test("struct", () => {
  const src = `
    struct A {
      a: B,
    }
  `;
  const result = parseWESL(src);
  const { scope } = result;
  const scopeIdents = scope.idents.map(i => i.originalName);
  expect(scopeIdents).toEqual(["A"]);

  const { children } = scope;
  expect(children.length).toBe(1);
  const firstChildIdents = children[0].idents.map(i => i.originalName);
  expect(firstChildIdents).toEqual(["B"]);
});

test("alias", () => {
  const src = `
    alias A = B;
  `;
  const result = parseWESL(src);
  const { scope } = result;
  const scopeIdents = scope.idents.map(i => i.originalName);
  expect(scopeIdents).toEqual(["A", "B"]);
});

test("switch", () => {
  const src = `
    fn main() {
      var code = 1u;
      switch ( code ) {
        case 5u: { if 1 > 0 { var x = 7;} }
        default: { break; }
      }
    }`;
  const result = parseWESL(src);
  const { scope } = result;
  expect(scopeIdentTree(scope)).toMatchInlineSnapshot(`
    "{ %main
      { %code, code
        { 
          { %x }
        }
        {  }
      }
    }"
  `);
});
