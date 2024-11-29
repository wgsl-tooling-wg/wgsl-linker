import { build, Plugin } from "esbuild";
import { readFile } from "node:fs/promises";
import * as path from "path";

// an esbuild script with a plugin to handle ?raw style imports

build({
  plugins: [raw()],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "bin/wgsl-packager",
  entryPoints: ["src/main.ts"],
});

/** Package resources as strings via ?raw */
function raw(): Plugin {
  return {
    name: "raw",
    setup(build) {
      build.onResolve({ filter: /\?raw$/ }, args => {
        return {
          path:
            path.isAbsolute(args.path) ?
              args.path
            : path.join(args.resolveDir, args.path),
          namespace: "raw-loader",
        };
      });
      build.onLoad(
        { filter: /\?raw$/, namespace: "raw-loader" },
        async args => {
          return {
            contents: await readFile(args.path.replace(/\?raw$/, "")),
            loader: "text",
          };
        },
      );
    },
  };
}
