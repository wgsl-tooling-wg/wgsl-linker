#!/usr/bin/env node
import { hideBin } from "yargs/helpers";
import { cli } from "./cli.js";

const rawArgs = hideBin(process.argv);

await cli(rawArgs);
