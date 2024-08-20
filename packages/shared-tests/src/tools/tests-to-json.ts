#!/usr/bin/env node
import fs from "fs";
import { importCases } from "../test-cases/LegacyImportCases.js";

main();

async function main(): Promise<void> {
  const json = JSON.stringify(importCases, null, 2);
  fs.writeFileSync("./src/test-cases/import-cases.json", json);
}
