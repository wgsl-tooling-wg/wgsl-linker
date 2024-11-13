#!/usr/bin/env node
import { hideBin } from "yargs/helpers";
import { packagerCli } from "./packagerCli.ts";

const rawArgs = hideBin(process.argv);

packagerCli(rawArgs);
