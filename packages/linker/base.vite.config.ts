/// <reference types="vitest" />
import { resolve } from "path";
import { UserConfig } from "vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";

export function baseViteConfig(): UserConfig {
  return {
    plugins: [
      tsconfigPaths(),
      dts(), // generate .d.ts files
    ],
    build: {
      lib: {
        name: "wgsl-linker",
        entry: [resolve(__dirname, "src/index.ts")],
        formats: ["es", "cjs"],
      },
      minify: false,
      sourcemap: true,
    },
  };
}
