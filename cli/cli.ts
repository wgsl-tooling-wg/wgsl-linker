import { ModuleRegistry, normalize } from "@wesl/linker";
import { createTwoFilesPatch } from "diff";
import { TypeRefElem } from "../linker/AbstractElems.ts";
import yargs from "yargs";

// TODO: Check if these are correct, and figure out why the types are broken
type CliArgs = {
  define?: (string | number)[];
  baseDir?: string;
  separately: boolean;
  details: boolean;
  diff: boolean;
  emit: boolean;
  files: string[];
};

export async function cli(rawArgs: string[]): Promise<void> {
  const argv = parseArgs(rawArgs);
  const files = argv.files as string[];
  if (argv.separately) await linkSeparately(argv, files);
  else await linkNormally(argv, files);
}

function parseArgs(args: string[]): CliArgs {
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
    .option("separately", {
      type: "boolean",
      default: false,
      hidden: true,
      describe: "link each file separately (for parser testing)",
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

async function linkNormally(argv: CliArgs, paths: string[]): Promise<void> {
  const basedPaths = paths.map((path) => ({
    path: path,
    basedPath: normalize(rmBaseDirPrefix(argv.baseDir, path)),
  }));
  const wgsl: Record<string, string> = {};
  for (const { path, basedPath } of basedPaths) {
    wgsl[basedPath] = await Deno.readTextFile(path);
  }
  const registry = new ModuleRegistry({ wgsl });
  const srcPath = basedPaths[0].basedPath;
  const srcText = wgsl[srcPath];
  doLink(argv, srcPath, registry, srcText);
}

async function linkSeparately(argv: CliArgs, paths: string[]): Promise<void> {
  for (const path of paths) {
    const srcText = await Deno.readTextFile(path);
    const basedPath = normalize(rmBaseDirPrefix(argv.baseDir, path));
    const registry = new ModuleRegistry({ wgsl: { [basedPath]: srcText } });
    doLink(argv, basedPath, registry, srcText);
  }
}

function doLink(
  argv: CliArgs,
  srcPath: string,
  registry: ModuleRegistry,
  origWgsl: string,
): void {
  const asRelative = "./" + srcPath;
  const linked = registry.link(asRelative, externalDefines(argv));
  if (argv.emit) console.log(linked);
  if (argv.diff) printDiff(srcPath, origWgsl, linked);
  if (argv.details) printDetails(argv, srcPath, registry);
}

function externalDefines(argv: CliArgs): Record<string, string> {
  if (!argv.define) return {};
  const pairs = argv.define.map((d) => d.toString().split("="));

  const badPair = pairs.find((p) => p.length !== 2);
  if (badPair) {
    console.error("invalid define", badPair);
    return {};
  }

  const withParsedValues = pairs.map(([k, v]) => [k, parseDefineValue(v)]);
  return Object.fromEntries(withParsedValues);
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

function printDetails(
  argv: CliArgs,
  modulePath: string,
  registry: ModuleRegistry,
): void {
  console.log(modulePath, ":");
  const parsed = registry.parsed(externalDefines(argv));
  const m = parsed.findTextModule(modulePath)!;
  m.fns.forEach((f) => {
    console.log(`  fn ${f.name}`);
    const calls = f.calls.map((c) => c.name).join("  ");
    console.log(`    calls: ${calls}`);
    printTypeRefs(f);
  });
  m.vars.forEach((v) => {
    console.log(`  var ${v.name}`);
    printTypeRefs(v);
  });
  m.structs.forEach((s) => {
    console.log(`  struct ${s.name}`);
    const members = (s.members ?? []).map((m) => m.name).join("  ");
    console.log(`    members: ${members}`);
    s.members.map((m) => printTypeRefs(m));
  });
  console.log();
}

function printTypeRefs(hasTypeRefs: { typeRefs: TypeRefElem[] }): void {
  const typeRefs = hasTypeRefs.typeRefs.map((t) => t.name).join("  ");
  console.log(`    typeRefs: ${typeRefs}`);
}

function rmBaseDirPrefix(baseDir: string | undefined, path: string): string {
  if (baseDir) {
    const found = path.indexOf(baseDir);
    if (found !== -1) {
      return path.slice(found + baseDir.length);
    }
  }
  return path;
}
