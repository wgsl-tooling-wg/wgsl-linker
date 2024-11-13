import { expect, test } from "vitest";
import { stub } from "@std/testing/mock";
import { cli } from "../cli.ts";
import { assertSnapshot } from "@std/testing/snapshot";

/** so vitest triggers when these files change */
// Deno doesn't support this at the moment :(
// https://github.com/denoland/deno/issues/17994#issuecomment-1879636936 hasn't materialized yet
// import("./src/test/wgsl/main.wgsl?raw");
// import("./src/test/wgsl/util.wgsl?raw");

test("simple link", async (ctx) => {
  using consoleStub = stub(console, "log", () => {});
  await cli(
    `./test/wgsl/main.wgsl 
       ./test/wgsl/util.wgsl`.split(/\s+/),
  );
  const logged = consoleStub.calls[0].args.join("");
  await assertSnapshot(ctx, logged);
});

test.ignore("link with definition", async () => {
  using consoleStub = stub(console, "log", () => {});
  await cli(
    `./test/wgsl/main.wgsl 
       ./test/wgsl/util.wgsl
       --define EXTRA=true`.split(/\s+/),
  );
  const logged = consoleStub.calls[0].args.join("");
  expect(logged).toContain("fn extra()");
});
