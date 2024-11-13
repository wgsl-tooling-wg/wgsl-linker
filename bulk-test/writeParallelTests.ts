import * as path from "@std/path";

const numParts = 16;

await writeFiles();

async function writeFiles(): Promise<void> {
  const writes = Array.from({ length: numParts }).map((_, i) => {
    const fileName = `parallel-${i}.test.ts`;
    const filePath = path.join("src", "test", fileName);
    console.log(`Writing ${filePath}`);
    return Deno.writeTextFile(filePath, testText(i));
  });

  await Promise.all(writes);
}

function testText(i: number) {
  return `
import { pathSets } from "../parallelDriver.ts";
import { testWgslFiles } from "../parallelTest.ts";

testWgslFiles(pathSets[${i}]);
`;
}
