import { test, expect } from "vitest";
import * as API from "../src";
import pkg from "../package.json";

test("Library dependencies", () => {
  expect(Object.keys(pkg.dependencies)).toMatchInlineSnapshot(`
    [
      "@rollup/plugin-node-resolve",
      "acorn",
      "comment-parser",
      "fast-glob",
      "fs-extra",
      "prettier",
      "rollup",
      "rollup-plugin-svelte",
      "svelte",
      "svelte-preprocess",
      "typescript",
    ]
  `);
});

test("Library exports", () => {
  expect(Object.keys(API)).toMatchInlineSnapshot(`
    [
      "default",
      "ComponentParser",
      "cli",
      "sveld",
    ]
  `);
});
