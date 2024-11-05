#!/usr/bin/env node
import { hideBin } from "yargs/helpers";
import { packagerCli } from "./packagerCli.js";

const rawArgs = hideBin(process.argv);

packagerCli(rawArgs);
