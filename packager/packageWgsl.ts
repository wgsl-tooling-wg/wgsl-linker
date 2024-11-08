import { WgslBundle } from "@wesl/linker";
import { expandGlob } from "@std/fs";
import * as path from "@std/path";
// TODO: Replace this with a proper npm dependency
const wgslBundleDecl = `
export interface WgslBundle {
  /** name of the package, e.g. wgsl-rand */
  name: string;

  /** npm version of the package  e.g. 0.4.1 */
  version: string;

  /** wesl edition of the code e.g. wesl_unstable_2024_1 */
  edition: string;

  /** map of wesl/wgsl modules:
   *    keys are file paths, relative to package root (e.g. "./lib.wgsl")
   *    values are wgsl/wesl code strings
   */
  modules: Record<string, string>;
}
`;

export type CliArgs = {
  rootDir: string;
  projectDir: string;
  outDir: string;
};

export async function packageWgsl(args: CliArgs): Promise<void> {
  const { projectDir, outDir } = args;
  const modules = await loadModules(args);
  const pkgJsonPath = path.join(projectDir, "package.json");
  const { name, version } = await loadPackageFields(pkgJsonPath);
  const edition = "wesl_unstable_2024_1";

  await writeJsBundle({ name, version, edition, modules }, outDir);
  await writeTypeScriptDts(outDir);
}

async function writeTypeScriptDts(outDir: string): Promise<void> {
  const constDecl = `
export declare const wgslBundle: WgslBundle;
export default wgslBundle;
`;
  const declText = wgslBundleDecl + constDecl;
  const outPath = path.join(outDir, "wgslBundle.d.ts");
  await Deno.writeTextFile(outPath, declText);
}

async function writeJsBundle(
  wgslBundle: WgslBundle,
  outDir: string,
): Promise<void> {
  await Deno.mkdir(outDir, { recursive: true });

  const bundleString = JSON.stringify(wgslBundle, null, 2);
  const outString = `
export const wgslBundle = ${bundleString}

export default wgslBundle;
  `;
  const outPath = path.join(outDir, "wgslBundle.js");
  await Deno.writeTextFile(outPath, outString);
}

async function loadModules(args: CliArgs): Promise<Record<string, string>> {
  const { rootDir } = args;
  const shaderFiles =
    (await Array.fromAsync(expandGlob(`${rootDir}/*.w[ge]sl`, {
      exclude: ["node_modules/**"],
    }))).filter((f) => f.isFile);
  const promisedSrcs = shaderFiles.map((f) => Deno.readTextFile(f.path));
  const src = await Promise.all(promisedSrcs);
  const relativePaths = shaderFiles.map((p) => path.relative(rootDir, p.path));
  const moduleEntries = zip(relativePaths, src);
  return Object.fromEntries(moduleEntries);
}

function zip<A, B>(as: A[], bs: B[]): [A, B][] {
  return as.map((a, i) => [a, bs[i]]);
}

interface PkgFields {
  name: string;
  version: string;
  exports?: Record<string, any>;
}

async function loadPackageFields(pkgJsonPath: string): Promise<PkgFields> {
  console.log(pkgJsonPath);
  const pkgJsonString = await Deno.readTextFile(pkgJsonPath);
  const pkgJson = JSON.parse(pkgJsonString);
  const { version, name, exports } = pkgJson;
  verifyField("version", version);
  verifyField("name", name);

  function verifyField(field: string, value: any): void {
    if (value === undefined) {
      console.error(`no '${field}' field found in "${pkgJsonPath}"`);
      throw new Error("package.json incomplete");
    }
  }
  return { name, version, exports };
}
