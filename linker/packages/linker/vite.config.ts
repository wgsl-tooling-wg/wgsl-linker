/// <reference types="vitest" />
import { defineConfig } from "vite";
import { baseViteConfig } from "./base.vite.config.js";
// import { visualizer } from "rollup-plugin-visualizer";

const config = baseViteConfig();
config.test = { setupFiles: "./src/test/TestSetup.ts" };

// so vitest reruns when tests change
const aliasPath = new URL("../../../wesl-testsuite", import.meta.url).pathname;
config.resolve = { alias: { "wesl-testsuite": aliasPath } };

export default defineConfig(config);
