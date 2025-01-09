import { createTwoFilesPatch } from "diff";
import fs from "fs";
import { enableTracing } from "mini-parse";
import { astTree, linkWeslFiles, normalize, scopeIdentTree } from "wgsl-linker";
import yargs from "yargs";
import {
  parsedRegistry,
  parseIntoRegistry,
} from "../../linker/src/ParsedRegistry.js";

type CliArgs = ReturnType<typeof parseArgs>;
let argv: CliArgs;

export async function cli(rawArgs: string[]): Promise<void> {
  enableTracing(); // so we get more debug info
  argv = parseArgs(rawArgs);
  const files = argv.files as string[];
  linkNormally(files);
}

function parseArgs(args: string[]) {
  return yargs(args)
    .command(
      "$0 <files...>",
      "root wgsl file followed by any library wgsl files",
    )
    .option("define", {
      type: "array",
      describe: "definitions for preprocessor and linking",
    })
    .option("baseDir", {
      requiresArg: true,
      type: "string",
      describe: "rm common prefix from file paths",
    })
    .option("details", {
      type: "boolean",
      default: false,
      hidden: true,
      describe: "show details about parsed files",
    })
    .option("diff", {
      type: "boolean",
      default: false,
      hidden: true,
      describe: "show comparison with src file",
    })
    .option("emit", {
      type: "boolean",
      default: true,
      hidden: true,
      describe: "emit linked result",
    })
    .help()
    .parseSync();
}

function linkNormally(paths: string[]): void {
  const pathAndTexts = paths.map(f => {
    const text = fs.readFileSync(f, { encoding: "utf8" });
    const basedPath = "./" + normalize(rmBaseDirPrefix(f));
    return [basedPath, text];
  });
  const [rootPath] = pathAndTexts[0];
  const weslFiles = Object.fromEntries(pathAndTexts);

  // TODO conditions
  // TODO external defines
  if (argv.emit) {
    const linked = linkWeslFiles(weslFiles, rootPath);
    if (argv.emit) console.log(linked.dest);
  }
  if (argv.details) {
    const registry = parsedRegistry();
    try {
      parseIntoRegistry(weslFiles, registry, "package");
    } catch (e) {
      console.error(e);
    }
    Object.entries(registry.modules).forEach(([modulePath, ast]) => {
      console.log(`---\n${modulePath}`);
      console.log(`\n->ast`);
      console.log(astTree(ast.moduleElem));
      console.log(`\n->scope`);
      console.log(scopeIdentTree(ast.rootScope));
      console.log();
    });
  }

  // TODO diff 
  // if (argv.diff) printDiff(srcPath, origWgsl, linked);
}

function externalDefines(): Record<string, string> {
  if (!argv.define) return {};
  const pairs = argv.define.map(d => d.toString().split("="));

  const badPair = pairs.find(p => p.length !== 2);
  if (badPair) {
    console.error("invalid define", badPair);
    return {};
  }

  throw new Error("external defines Not implemented");
  const withParsedValues = pairs.map(([k, v]) => [k, parseDefineValue(v)]);
  // return Object.fromEntries(withParsedValues);
}

function parseDefineValue(value: string): string | number | boolean {
  const v = value.toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  if (value === "NaN") return NaN;
  const n = Number.parseFloat(value);
  if (!Number.isNaN(n)) return n;
  return value;
}

function printDiff(modulePath: string, src: string, linked: string): void {
  if (src !== linked) {
    const patch = createTwoFilesPatch(modulePath, "linked", src, linked);
    console.log(patch);
  } else {
    console.log(`${modulePath}: linked version matches original source`);
  }
}

function rmBaseDirPrefix(path: string): string {
  const baseDir = argv.baseDir;
  if (baseDir) {
    const found = path.indexOf(baseDir);
    if (found !== -1) {
      return path.slice(found + baseDir.length);
    }
  }
  return path;
}
