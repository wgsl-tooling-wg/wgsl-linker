/// <reference types="vitest" />
import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts()],
  test: { setupFiles: "./src/test/TestSetup.ts" },
  build: {
    lib: {
      name: "mini-parse",
      entry: [resolve(__dirname, "src/index.ts")],
    },
    minify: false,
    sourcemap: true,
  },
});
