/// <reference types="vitest" />
import assert from "node:assert";
import { resolve } from "path";
import { LibraryOptions, defineConfig } from "vite";
import baseViteConfig from "./vite.config.js";

const config = baseViteConfig;
assert(config.build);
config.build.emptyOutDir = false;
const lib = config.build.lib as LibraryOptions;
lib.name = "mini-parse-test-util";
lib.formats = ["es"];
lib.entry = [resolve(__dirname, "./src/test-util/index.ts")];
lib.fileName = "testUtil";

// config.plugins?.push(visualizer({ brotliSize: true, gzipSize: true })); // generate stats.html size report

export default defineConfig(config);

// {
//   plugins: [
//     tsconfigPaths(),
//     dts(), // generate
//     // visualizer({ brotliSize: true, gzipSize: true }), // generate stats.html size report
//   ],
//   build: {
//     emptyOutDir: false,
//     lib: {
//       name: "mini-parse-testing",
//       formats: ["es"],
//       entry: [resolve(__dirname, "./src/test-util/index.ts")],
//       fileName: "testUtil"
//     },
//     rollupOptions: {
//       // make sure to externalize deps that shouldn't be bundled
//       // into your library
//       external: ['vitest', 'mini-parse'],
//     },
//     minify: false,
//     sourcemap: true,
//   },
// });
