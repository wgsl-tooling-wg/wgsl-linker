#!/usr/bin/env node
import { hideBin } from "yargs/helpers";
import { cli } from "./cli.ts";

const rawArgs = hideBin(process.argv);

cli(rawArgs);
