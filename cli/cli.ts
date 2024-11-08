import { createTwoFilesPatch } from "diff";
import fs from "fs";
import { ModuleRegistry, normalize } from "wgsl-linker";
import { createTwoFilesPatch } from "diff";
import { TypeRefElem } from "../linker/AbstractElems.ts";

type CliArgs = ReturnType<typeof parseArgs>;
let argv: CliArgs;

export async function cli(rawArgs: string[]): Promise<void> {
  argv = parseArgs(rawArgs);
  const files = argv.files as string[];
  if (argv.separately) linkSeparately(files);
  else linkNormally(files);
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

function linkNormally(paths: string[]): void {
  const pathAndTexts = paths.map((f) => {
    const text = fs.readFileSync(f, { encoding: "utf8" });
    const basedPath = normalize(rmBaseDirPrefix(f));
    return [basedPath, text];
  });
  const wgsl = Object.fromEntries(pathAndTexts);
  const registry = new ModuleRegistry({ wgsl });
  const [srcPath, srcText] = pathAndTexts[0];
  doLink(srcPath, registry, srcText);
}

function linkSeparately(paths: string[]): void {
  paths.forEach((f) => {
    const srcText = fs.readFileSync(f, { encoding: "utf8" });
    const basedPath = normalize(rmBaseDirPrefix(f));
    const registry = new ModuleRegistry({ wgsl: { [basedPath]: srcText } });
    doLink(basedPath, registry, srcText);
  });
}

function doLink(
  srcPath: string,
  registry: ModuleRegistry,
  origWgsl: string,
): void {
  const asRelative = "./" + srcPath;
  const linked = registry.link(asRelative, externalDefines());
  if (argv.emit) console.log(linked);
  if (argv.diff) printDiff(srcPath, origWgsl, linked);
  if (argv.details) printDetails(srcPath, registry);
}

function externalDefines(): Record<string, string> {
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

function printDetails(modulePath: string, registry: ModuleRegistry): void {
  console.log(modulePath, ":");
  const parsed = registry.parsed(externalDefines());
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
