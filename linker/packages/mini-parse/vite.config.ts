/// <reference types="vitest" />
import { LibraryOptions, defineConfig } from "vite";
import { baseViteConfig } from "./base.vite.config.js";

const config = baseViteConfig();
config.test = { setupFiles: "./src/test/TestSetup.ts" };
(config.build.lib as LibraryOptions).formats = ["es", "cjs"];
(config.build.lib as LibraryOptions).name = "mini-parse";

export default defineConfig(config);
