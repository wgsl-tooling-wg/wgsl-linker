import fs from "node:fs/promises";

const numParts = 16;

await writeFiles();

async function writeFiles(): Promise<void> {
  const writes = Array.from({ length: numParts }).map((_, i) => {
    const path = `unityBoatPart${i}.test.ts`;
    console.log(`Writing ${path}`);
    return fs.writeFile(path, testText(i), { encoding: "utf8" });
  });

  await Promise.all(writes);
}

function testText(i: number) {
  return `
import { boatParts, testWgslFiles } from "./unityBoatParts.js";

testWgslFiles(boatParts[${i}]);
`;
}
