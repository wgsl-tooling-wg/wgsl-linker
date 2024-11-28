import { pretty, dlog, dlogOpt } from "berry-pretty";
import { expect, test } from "vitest";
import { Ident, Scope, withAddedIdent } from "../Scope.ts";

test("withAddendIdent shallow", () => {
  const origRoot: Scope = {
    kind: "module",
    children: [],
    parent: null,
    idents: [],
  };
  const ident: Ident = {
    kind: "decl",
    originalName: "x",
  };
  const { rootScope, scope } = withAddedIdent(origRoot, origRoot, ident);
  expect(rootScope.idents.map(i => i.originalName)).toEqual(["x"]);
  expect(rootScope).not.toBe(origRoot);
  expect(scope).toBe(rootScope);
});

test("withAddendIdent in child scope", () => {
  const origChild: Scope = {
    kind: "body",
    children: [],
    parent: null,
    idents: [],
  };
  const origRoot: Scope = {
    kind: "module",
    children: [origChild],
    parent: null,
    idents: [{originalName: "main", kind: "decl"}],
  };
  origChild.parent = origRoot;
  const ident: Ident = {
    kind: "decl",
    originalName: "x",
  };
  const { rootScope, scope } = withAddedIdent(origRoot, origChild, ident);
  expect(rootScope.idents.map(i => i.originalName)).toEqual(["main"]);
  expect(rootScope).not.toBe(origRoot);
  expect(scope).not.toBe(rootScope);
  expect(scope.idents.map(i => i.originalName)).toEqual(["x"]);
  expect(rootScope.children[0]).toBe(scope);
});
