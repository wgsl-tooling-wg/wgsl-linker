/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.ts";

const wgsl1: Record<string, string> = import.meta.glob("./wgsl_1/*.wgsl", {
  query: "?raw",
  eager: true,
  import: "default",
});

const wgsl2: Record<string, string> = import.meta.glob("./wgsl_2/*.wgsl", {
  query: "?raw",
  eager: true,
  import: "default",
});

test("basic import glob", async () => {
  const linked = new ModuleRegistry({ wgsl: wgsl1 }).link("main");
  expect(linked).toContain("fn bar()");
});

test("#import from path ./util", async () => {
  const linked = new ModuleRegistry({ wgsl: wgsl2 }).link("main2");
  expect(linked).toContain("fn bar()");
});
