import { printParser } from "mini-parse";
import {test} from "vitest";
import { struct_decl, typeNameDecl, weslRoot } from "../WESLGrammar.ts";

test("print grammar", () => {
  printParser(weslRoot);
})