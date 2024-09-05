#!/usr/bin/env node
import { glob } from "glob";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

type CliArgs = ReturnType<typeof parseArgs>;

main();

/** generate a .ts file script that will generate json files
 * the generated script:
 *  . imports each .ts files in the src directory
 *  . outputs a json file for each .ts file in the dest directory
*/
async function main(): Promise<void> {
  const rawArgs = hideBin(process.argv);
  const args: CliArgs = parseArgs(rawArgs);
  const srcDir = args.src_dir as string;
  const destDir = args.dest_dir as string;

  const tsFiles = await glob(`${srcDir}/*.ts`);
  const header = `#!/usr/bin/env node
    import fs from "fs";
  `;

  const snippets = tsFiles.map((tsFile) => {
    const baseName = path.basename(tsFile, ".ts");
    const importFile = tsFile.replace(/\.ts$/, ".js");
    const baseNameLower = baseName[0].toLowerCase() + baseName.slice(1);
    const jsonName = baseNameLower + "Json";
    const destFileName = baseNameLower + ".json";
    const destFile = path.join(destDir, destFileName);
    return `
      import ${baseNameLower} from "../${importFile}";
      const ${jsonName} = JSON.stringify(${baseNameLower}, null, 2);
      fs.writeFileSync("${destFile}", ${jsonName});
    `;
  });

  const chunks = [header, ...snippets];
  const lines = chunks.flatMap(c => c.split("\n"));
  const trimmed = lines.map(l => l.trim());
  const joined = trimmed.join("\n");
  console.log(joined);
}


function parseArgs(args: string[]) {
  return yargs(args)
    .command("$0 <src_dir> <dest_dir>", "generate json files for test cases")
    .parseSync();
}