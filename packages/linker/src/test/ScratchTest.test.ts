import { test } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.ts";
import { WgslBundle } from "../WgslBundle.ts";

const randBundle: WgslBundle = {
  name: "random_wgsl",
  version: "0.1.0",
  edition: "wesl_unstable_2024_1",
  modules: {
    "lib.wgsl": "",
  },
};

// temporary test for debugging current issue
test("example", () => {
  const wgsl = {
    "./main.wgsl": `
import random_wgsl/pcg_2u_3f;

// foo 
fn main() { } 
`,
  };

  const registry = new ModuleRegistry({ wgsl, libs: [randBundle] });
  registry.link("./main");
});
