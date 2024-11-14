#!/usr/bin/env -S deno run --allow-read --allow-write
import { cli } from "./cli.ts";

if (import.meta.main) {
    await cli(Deno.args);
}
