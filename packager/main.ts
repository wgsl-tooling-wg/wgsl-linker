#!/usr/bin/env -S deno run --allow-read --allow-write

import yargs from "yargs";
import { CliArgs, packageWgsl } from "./packageWgsl.ts";

if (import.meta.main) {
    await packageWgsl(parseArgs(Deno.args));
}

export function parseArgs(args: string[]): CliArgs {
    return (
        yargs(args)
            .command("$0", "create an npm package from WGSL/WESL files")
            .option("rootDir", {
                type: "string",
                default: ".",
                describe: "base directory of WGSL/WESL files",
            })
            .option("projectDir", {
                type: "string",
                default: ".",
                describe: "directory containing package.json",
            })
            // .option("updatePackageJson", {
            //   type: "boolean",
            //   default: true,
            //   describe: "add export entries into package.json",
            // })
            .option("outDir", {
                type: "string",
                default: "dist",
                describe: "where to put bundled output files",
            })
            .help()
            .parseSync()
    );
}
