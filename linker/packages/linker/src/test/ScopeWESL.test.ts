import { expect, test } from "vitest";
import { parseWESL } from "../ParseWESL.ts";
import { logScope } from "../Scope.ts";

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
  expect(firstChildIdents).toEqual(["x"]);
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
  expect(firstChildIdents).toEqual(["x", "x"]);
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
  `
  const result = parseWESL(src);
  const { scope } = result;
  const scopeIdents = scope.idents.map(i => i.originalName);
  expect(scopeIdents).toEqual(["foo", "bar"]);
});