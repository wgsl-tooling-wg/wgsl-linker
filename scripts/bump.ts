import fs from "node:fs";
import glob from "fast-glob";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { promisify } from "node:util";
import { exec as execOrig } from "node:child_process";
const execAsync = promisify(execOrig);

const argv = yargs(hideBin(process.argv))
  .version(false)
  .options({
    version: {
      alias: "v",
      type: "string",
      demandOption: true,
      requiresArg: true,
    },
  })
  .parseSync();

run(argv.version);

async function run(version: string): Promise<void> {
  const dirty = await gitDirty();
  if (dirty) {
    console.error("git repository has uncommitted changes, aborting");
    process.exit(1);
  }
  await setPackageVersions(version);
  await commitAndTag(version);
}

async function setPackageVersions(version: string): Promise<void> {
  const packages = await glob("packages/*/package.json");

  packages.forEach((packagePath) => {
    const pkgString = fs.readFileSync(packagePath, { encoding: "utf8" });
    const packageJson = JSON.parse(pkgString);
    packageJson.version = version;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + "\n");
  });
}

async function gitDirty(): Promise<boolean> {
  const status = await execAsync("git status --short");
  return status.stdout !== "";
}

async function commitAndTag(version: string): Promise<void> {
  await execAsync(`git commit -a -m 'bump version to ${version}'`);
  await execAsync(`git tag v${version}`);
}
