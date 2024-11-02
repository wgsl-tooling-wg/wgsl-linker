import { expect, test, vi } from "vitest";
import { cli } from "../cli.js";

test("simple link", async () => {
  const logged = await cliLine(
    `./src/test/wgsl/main.wgsl 
       ./src/test/wgsl/util.wgsl`,
  );
  expect(logged).toMatchSnapshot();
});

test("link with definition", async () => {
  const logged = await cliLine(
    `./src/test/wgsl/main.wgsl 
       ./src/test/wgsl/util.wgsl
       --define EXTRA=true`,
  );
  expect(logged).to.include("fn extra()");
});

async function cliLine(argsLine: string): Promise<string> {
  return await withConsoleSpy(() => cli(argsLine.split(/\s+/)));
}

async function withConsoleSpy(fn: () => Promise<void>): Promise<string> {
  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  await fn();
  const result = consoleSpy.mock.calls[0].join("");
  vi.resetAllMocks();
  return result;
}
