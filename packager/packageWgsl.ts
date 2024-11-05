import { CliArgs } from "./packagerCli.ts";
import { glob } from "glob";
import fs, { mkdir } from "node:fs/promises";
import { WgslBundle } from "@wesl/linker";
import wgslBundleDecl from "../../linker/src/WgslBundle.ts?raw";
import { CliArgs } from "./packagerCli.js";

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
  await fs.writeFile(outPath, declText);
}

async function writeJsBundle(
  wgslBundle: WgslBundle,
  outDir: string,
): Promise<void> {
  await mkdir(outDir, { recursive: true });

  const bundleString = JSON.stringify(wgslBundle, null, 2);
  const outString = `
export const wgslBundle = ${bundleString}

export default wgslBundle;
  `;
  const outPath = path.join(outDir, "wgslBundle.js");
  await fs.writeFile(outPath, outString);
}

async function loadModules(args: CliArgs): Promise<Record<string, string>> {
  const { rootDir } = args;
  const shaderFiles = await glob(`${rootDir}/*.w[ge]sl`, {
    ignore: "node_modules/**",
  });
  const promisedSrcs = shaderFiles.map(f =>
    fs.readFile(f, { encoding: "utf8" }),
  );
  const src = await Promise.all(promisedSrcs);
  const relativePaths = shaderFiles.map(p => path.relative(rootDir, p));
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
  const pkgJsonString = await fs.readFile(pkgJsonPath, { encoding: "utf8" });
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
