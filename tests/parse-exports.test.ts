import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseExports } from "../src/parse-exports";

const UNRESOLVED_RELATIVE_PATH_REGEX = /cannot resolve "\.\/sveld-test-does-not-exist"/;
const UNRESOLVED_ALIAS_REGEX = /cannot resolve "\$components\/Button\.svelte"/;

describe("parseExports", () => {
  test("circular `export *` between two barrel files does not overflow the stack", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-parse-exports-circular-"));

    try {
      writeFileSync(path.join(dir, "A.js"), `export * from "./B.js";\nexport { helper } from "./helper.js";\n`);
      writeFileSync(path.join(dir, "B.js"), `export * from "./A.js";\nexport { other } from "./other.js";\n`);
      writeFileSync(path.join(dir, "helper.js"), "export const helper = 1;\n");
      writeFileSync(path.join(dir, "other.js"), "export const other = 2;\n");

      const source = `export * from "./B.js";\nexport { helper } from "./helper.js";\n`;

      const result = parseExports(source, dir);
      expect(Object.keys(result).sort()).toEqual(["helper", "other"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("single default export", () => {
    const source = `export { default } from "./Component.svelte";`;

    expect(parseExports(source, "")).toEqual({
      default: {
        source: "./Component.svelte",
        default: true,
      },
    });
  });

  test("single default export (declaration)", () => {
    const source = `
    import Component from "./Component.svelte";
    export default Component;`;

    expect(parseExports(source, "")).toEqual({
      Component: {
        source: "./Component.svelte",
        default: true,
      },
    });
  });

  test("single named export", () => {
    const source = `export { default as Component } from "./Component.svelte";`;

    expect(parseExports(source, "")).toEqual({
      Component: {
        source: "./Component.svelte",
        default: true,
      },
    });
  });

  test("multiple named exports", () => {
    const source = `
    export { default as Component } from "./Component.svelte";
    export { default as Component2 } from "./Component2.svelte";`;

    expect(parseExports(source, "")).toEqual({
      Component: { source: "./Component.svelte", default: true },
      Component2: { source: "./Component2.svelte", default: true },
    });
  });

  test("multiple named exports with a default export", () => {
    const source = `
    export { default as Component } from "./Component.svelte";
    export { default as Component2 } from "./Component2.svelte";
    export { default } from "./Component2.svelte";`;

    expect(parseExports(source, "")).toEqual({
      Component: { source: "./Component.svelte", default: true },
      Component2: { source: "./Component2.svelte", default: true },
      default: { source: "./Component2.svelte", default: true },
    });
  });

  test("multiple named exports with a default export (declaration)", () => {
    const source = `
    export { default as Component } from "./Component.svelte";
    export { default as Component2 } from "./Component2.svelte";

    import Component3 from "./Component3.svelte";
    export default Component3;`;

    expect(parseExports(source, "")).toEqual({
      Component: { source: "./Component.svelte", default: true },
      Component2: { source: "./Component2.svelte", default: true },
      Component3: { source: "./Component3.svelte", default: true },
    });
  });

  test("mixed exports", () => {
    const source = `
    import Component from "./Component.svelte";

    export { Component };
    export default Component;`;

    expect(parseExports(source, "")).toEqual({
      Component: {
        source: "./Component.svelte",
        default: true,
        mixed: true,
      },
    });
  });

  test("multiple, non-default exports (target has no matching re-exports, falls back to literal source)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-parse-exports-flat-"));

    try {
      writeFileSync(path.join(dir, "component.js"), "export const Component = 1;\nexport const Component2 = 2;\n");

      const source = `export { Component, Component2 } from "./component";`;

      expect(parseExports(source, dir)).toEqual({
        Component: { source: "./component", default: false },
        Component2: { source: "./component", default: false },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("target that is not parseable as plain JS (e.g. TypeScript syntax) falls back to literal source", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-parse-exports-ts-target-"));

    try {
      writeFileSync(path.join(dir, "constants.ts"), "export const MAX_RETRIES: number = 5;\n");

      const source = `export { MAX_RETRIES } from "./constants";`;

      expect(parseExports(source, dir)).toEqual({
        MAX_RETRIES: { source: "./constants", default: false },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("two-level named chain through a directory barrel", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-parse-exports-chain-"));

    try {
      const catDir = path.join(dir, "cat");
      mkdirSync(catDir);
      writeFileSync(path.join(catDir, "index.js"), `export { default as A } from "./A.svelte";\n`);

      const source = `export { A } from "./cat";`;

      expect(parseExports(source, dir)).toEqual({
        A: { source: "./cat/A.svelte", default: true },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rename through a named chain", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-parse-exports-chain-rename-"));

    try {
      const catDir = path.join(dir, "cat");
      mkdirSync(catDir);
      writeFileSync(path.join(catDir, "index.js"), `export { default as A } from "./A.svelte";\n`);

      const source = `export { A as B } from "./cat";`;

      expect(parseExports(source, dir)).toEqual({
        B: { source: "./cat/A.svelte", default: true },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("named chain by filename instead of directory", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-parse-exports-chain-filename-"));

    try {
      const catDir = path.join(dir, "cat");
      mkdirSync(catDir);
      writeFileSync(path.join(catDir, "index.js"), `export { default as A } from "./A.svelte";\n`);

      const source = `export { A } from "./cat/index.js";`;

      expect(parseExports(source, dir)).toEqual({
        A: { source: "./cat/A.svelte", default: true },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("three-level named chain", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-parse-exports-chain-three-"));

    try {
      const catDir = path.join(dir, "cat");
      const dogDir = path.join(catDir, "dog");
      mkdirSync(catDir);
      mkdirSync(dogDir);
      writeFileSync(path.join(dogDir, "index.js"), `export { default as A } from "./A.svelte";\n`);
      writeFileSync(path.join(catDir, "index.js"), `export { A } from "./dog";\n`);

      const source = `export { A } from "./cat";`;

      expect(parseExports(source, dir)).toEqual({
        A: { source: "./cat/dog/A.svelte", default: true },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("cycle between two named-chain barrels terminates", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sveld-parse-exports-chain-cycle-"));

    try {
      const catDir = path.join(dir, "cat");
      const dogDir = path.join(dir, "dog");
      mkdirSync(catDir);
      mkdirSync(dogDir);
      writeFileSync(path.join(catDir, "index.js"), `export { A } from "../dog";\n`);
      writeFileSync(path.join(dogDir, "index.js"), `export { A } from "../cat";\n`);

      const source = `export { A } from "./cat";`;

      expect(() => parseExports(source, dir)).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("unresolvable specifier warns and omits the entry", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const source = `export { A } from "./does-not-exist";`;

      expect(parseExports(source, "")).toEqual({});
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  test("mixed default and named export from same source", () => {
    const source = `export { default as Theme, themes } from "./Theme/Theme.svelte";`;

    expect(parseExports(source, "")).toEqual({
      Theme: { source: "./Theme/Theme.svelte", default: true },
      themes: { source: "./Theme/Theme.svelte", default: false },
    });
  });

  test("`export *` to a missing relative path throws a structured error instead of crashing raw", () => {
    const source = `export * from "./sveld-test-does-not-exist";`;

    expect(() => parseExports(source, "")).toThrow(UNRESOLVED_RELATIVE_PATH_REGEX);
  });

  test("named re-export with an unresolved alias throws a structured error", () => {
    const source = `export { default as Button } from "$components/Button.svelte";`;

    expect(() => parseExports(source, "")).toThrow(UNRESOLVED_ALIAS_REGEX);
  });
});
