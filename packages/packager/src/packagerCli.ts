import yargs from "yargs";
import { packageWgsl } from "./packageWgsl.js";

export type CliArgs = {
  rootDir: string;
  projectDir: string;
  updatePackageJson: boolean;
  outDir: string;
};

export async function packagerCli(rawArgs: string[]): Promise<void> {
  await packageWgsl(parseArgs(rawArgs));
}

function parseArgs(args: string[]) {
  return yargs(args)
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
    .option("updatePackageJson", {
      type: "boolean",
      default: true,
      describe: "add export entries into package.json",
    })
    .option("outDir", {
      type: "string",
      default: "dist",
      describe: "where to put bundled output files",
    })
    .help()
    .parseSync();
}
