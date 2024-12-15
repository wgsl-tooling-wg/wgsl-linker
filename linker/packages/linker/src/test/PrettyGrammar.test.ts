import { printParser } from "mini-parse";
import { test } from "vitest";
import { weslRoot } from "../WESLGrammar.ts";

test("print grammar", () => {
  printParser(weslRoot);
});
