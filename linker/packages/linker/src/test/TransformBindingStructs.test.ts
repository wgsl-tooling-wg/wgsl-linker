import { SrcMapBuilder } from "mini-parse";
import { expect, test } from "vitest";
import { bindIdents } from "../BindIdents.ts";
import { lowerAndEmit } from "../LowerAndEmit.ts";
import { parsedRegistry } from "../ParsedRegistry.ts";
import {
  markBindingStructs,
  transformBindingStruct,
} from "../TransformBindingStructs.ts";
import { parseTest } from "./TestUtil.ts";

test("markBindingStructs true", () => {
  const src = `
    struct Bindings {
      @group(0) @binding(0) particles: ptr<storage, array<f32>, read_write>, 
    }
  `;

  const ast = parseTest(src);
  const structs = markBindingStructs(ast.moduleElem);
  expect(structs.length).toBe(1);
  expect(structs[0].bindingStruct).toBe(true);
});

test("markBindingStructs false", () => {
  const src = `
    struct Bindings {
      particles: ptr<storage, array<f32>, read_write>, 
    }
  `;

  const ast = parseTest(src);
  const structs = markBindingStructs(ast.moduleElem);
  expect(structs.length).toBe(0);
});

test("transformBindingStruct", () => {
  const src = `
    struct Bindings {
      @group(0) @binding(0) particles: ptr<storage, array<f32>, read_write>, 
    }
  `;

  const ast = parseTest(src);
  bindIdents(ast, parsedRegistry(), {});
  const bindingStruct = markBindingStructs(ast.moduleElem)[0];
  const newVars = transformBindingStruct(bindingStruct);

  const srcBuilder = new SrcMapBuilder();
  lowerAndEmit(srcBuilder, newVars, {});
  const linked = srcBuilder.build().dest;
  expect(linked).toMatchInlineSnapshot(
    `"var @group(0) @binding(0) particles<storage, read_write> : array<f32>;"`,
  );
});
