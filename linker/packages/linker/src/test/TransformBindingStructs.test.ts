import {test, expect} from "vitest";
import { parseTest } from "./TestUtil.ts";
import { markBindingStructs } from "../TransformBindingStructs.ts";
import { astToString } from "../debug/ASTtoString.ts";

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