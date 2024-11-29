import { expect, test } from "vitest";
import { normalize } from "../PathUtil.js";

// ../../../lib/webgpu-samples/src/anim/anim.wgsl

test("normalize ./foo", () => {
  const n = normalize("./foo");
  expect(n).toBe("foo");
});

test("normalize ./foo/./", () => {
  const n = normalize("./foo/./");
  expect(n).toBe("foo");
});

test("normalize foo/bar/..", () => {
  const n = normalize("foo/bar/..");
  expect(n).toBe("foo");
});

test("normalize ./foo/bar/../.", () => {
  const n = normalize("./foo/bar/../.");
  expect(n).toBe("foo");
});

test("normalize ../foo", () => {
  const n = normalize("../foo");
  expect(n).toBe("../foo");
});

test("normalize ../../foo", () => {
  const n = normalize("../../foo");
  expect(n).toBe("../../foo");
});
