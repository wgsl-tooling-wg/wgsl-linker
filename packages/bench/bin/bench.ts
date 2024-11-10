import { WGSLLinker } from "@use-gpu/shader";
import fs from "fs/promises";
import { run } from "node:test";
import path from "path";
import { ModuleRegistry } from "wgsl-linker";
import { WgslReflect } from "wgsl_reflect";
import yargs from "yargs";

import { hideBin } from "yargs/helpers";

type ParserVariant =
  | "wgsl-linker"
  | "wgsl-linker.link" // NYI
  | "wgsl_reflect"
  | "use-gpu"
  | "all"; // NYI

type CliArgs = ReturnType<typeof parseArgs>;

const rawArgs = hideBin(process.argv);
main(rawArgs);

async function main(args: string[]): Promise<void> {
  const argv = parseArgs(args);
  await bench(argv);
}

function parseArgs(args: string[]) {
  return yargs(args)
    .option("bench", {
      type: "boolean",
      default: false,
      describe: "run a benchmark, collecting timings",
    })
    .option("variant", {
      choices: ["wgsl-linker", "wgsl_reflect", "use-gpu"] as const,
      default: "wgsl-linker",
      describe: "select parser to test",
    })
    .option("profile", {
      type: "boolean",
      default: false,
      describe: "run once, for attaching a profiler",
    })
    .help()
    .parseSync();
}

async function bench(argv: CliArgs): Promise<void> {
  const texts = await loadAllFiles();
  const variant: ParserVariant = selectVariant(argv.variant);

  if (argv.bench) {
    const ms = runBench(variant, texts);
    const codeLines = texts
      .map(t => t.text.split("\n").length)
      .reduce((a, b) => a + b, 0);
    const locSec = codeLines / ms;
    const locSecStr = new Intl.NumberFormat().format(Math.round(locSec));
    console.log(`${variant} LOC/sec: ${locSecStr}`);
  }

  if (argv.profile) {
    console.profile();
    runOnAllFiles(variant, texts);
    console.profileEnd();
  }
}

function selectVariant(variant: string): ParserVariant {
  if (variant === "wgsl-linker") {
    return "wgsl-linker";
  } else if (variant === "wgsl_reflect") {
    return "wgsl_reflect";
  } else if (variant === "use-gpu") {
    return "use-gpu";
  } else {
    throw new Error("NYI parser variant: " + variant);
  }
}

function runBench(variant: ParserVariant, files: LoadedFile[]): number {
  const warmupIterations = 5;
  const benchIterations = 20;

  // TODO try e.g. TinyBench instead

  /* warmup */
  runNTimes(warmupIterations, variant, files);

  /* test */
  const start = performance.now();
  runNTimes(benchIterations, variant, files);
  const ns = performance.now() - start;
  const ms = ns / benchIterations / 1000;
  return ms;
}

function runNTimes(
  n: number,
  variant: ParserVariant,
  files: LoadedFile[],
): void {
  for (let i = 0; i < n; i++) {
    runOnAllFiles(variant, files);
  }
}

function runOnAllFiles(variant: ParserVariant, files: LoadedFile[]): void {
  for (const file of files) {
    parseOnce(variant, file.name, file.text);
  }
}

interface LoadedFile {
  name: string;
  text: string;
}

async function loadAllFiles(): Promise<LoadedFile[]> {
  // const boat = await loadBoatFiles();
  // return [...boat];
  const reduceBuffer = await loadFile(
    "reduceBuffer",
    "./src/examples/reduceBuffer.wgsl",
  );
  const particle = await loadFile(
    "reduceBuffer",
    "../../../community-wgsl/webgpu-samples/sample/particles/particle.wgsl",
  );
  return [reduceBuffer, particle];
}

async function loadFile(name: string, path: string): Promise<LoadedFile> {
  const text = await fs.readFile(path, { encoding: "utf8" });

  return { name, text };
}

async function loadBoatFiles(): Promise<LoadedFile[]> {
  const boatAttackDir =
    "../../../community-wgsl/unity_web_research/webgpu/wgsl/boat_attack";

  const boatName = "unity_webgpu_0000026E5689B260.fs.wgsl";
  const boatPath = path.join(boatAttackDir, boatName);
  return [await loadFile(boatName, boatPath)];
}

function parseOnce(
  parserVariant: ParserVariant,
  filePath: string,
  text: string,
): void {
  if (parserVariant === "wgsl-linker") {
    wgslLinkerParse(filePath, text);
  } else if (parserVariant === "wgsl_reflect") {
    wgslReflectParse(filePath, text);
  } else if (parserVariant === "use-gpu") {
    useGpuParse(filePath, text);
  } else {
    throw new Error("NYI parser variant: " + parserVariant);
  }
}

function wgslLinkerParse(filePath: string, text: string): void {
  const registry = new ModuleRegistry({ wgsl: { [filePath]: text } });
  registry.parsed();
}

function wgslReflectParse(_filePath: string, text: string): void {
  new WgslReflect(text);
}

function useGpuParse(_filePath: string, text: string): void {
  WGSLLinker.loadModule(text);
}
