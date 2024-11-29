import { UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export function baseViteConfig(): UserConfig {
  return {
    plugins: [
      tsconfigPaths(),
      dts(), // generate .d.ts files
    ],
    build: {
      lib: {
        name: "mini-parse",
        entry: [resolve(__dirname, "src/index.ts")],
      },
      minify: false,
      sourcemap: true,
    },
  };
}
