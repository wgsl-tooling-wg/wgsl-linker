import assert from "node:assert";
import { resolve } from "path";
import { LibraryOptions, defineConfig } from "vite";
import baseViteConfig from "./vite.config.js";

const config = baseViteConfig;
assert(config.build);
config.build.emptyOutDir = false;

const lib = config.build.lib as LibraryOptions;
lib.name = "wgsl-linker-templates";
lib.entry = [resolve(__dirname, "src/templates/index.ts")];
lib.fileName = "templates";
config.build.rollupOptions = { external: ["wgsl-linker", "mini-parse"] };

export default defineConfig(config);
