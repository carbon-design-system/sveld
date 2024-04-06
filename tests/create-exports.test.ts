import { describe, expect, test } from "vitest";
import { convertSvelteExt, createExports, removeSvelteExt } from "../src/create-exports";

describe("createExports", () => {
  test("single default export", () => {
    const source = { default: { source: "./Component.svelte", default: true } };

    expect(createExports(source, new Map())).toEqual('export { default } from "./Component.svelte";');
  });

  test("single default export (declaration)", () => {
    const source = { Component: { source: "./Component.svelte", default: true } };

    expect(createExports(source, new Map())).toEqual(
      'export { default } from "./Component.svelte";'
    );
  });

  test("single named export", () => {
    const source = { Component: { source: "./Component.svelte", default: false } };

    expect(createExports(source, new Map())).toEqual(
      'export { default as Component } from "./Component.svelte";'
    );
  });

  test("multiple named exports", () => {
    const source = {
      Component: { source: "./Component.svelte", default: false },
      Component2: { source: "./Component2.svelte", default: false },
    };

    expect(createExports(source, new Map())).toEqual(`export { default as Component } from "./Component.svelte";
export { default as Component2 } from "./Component2.svelte";`);
  });

  test("multiple named exports with a default export", () => {
    const source = {
      Component: { source: "./Component.svelte", default: false },
      Component2: { source: "./Component2.svelte", default: false },
      default: { source: "./Component2.svelte", default: true },
    };

    expect(createExports(source, new Map())).toEqual(`export { default as Component } from "./Component.svelte";
export { default as Component2 } from "./Component2.svelte";
export { default } from "./Component2.svelte";`);
  });

  test("multiple named exports with a default export (declaration)", () => {
    const source = {
      Component: { source: "./Component.svelte", default: false },
      Component2: { source: "./Component2.svelte", default: false },
      Component3: { source: "./Component3.svelte", default: true },
    };

    expect(createExports(source, new Map())).toEqual(`export { default as Component } from "./Component.svelte";
export { default as Component2 } from "./Component2.svelte";
export { default } from "./Component3.svelte";`);
  });

  test("mixed exports", () => {
    const source = { Component: { source: "./Component.svelte", default: true, mixed: true } };

    expect(createExports(source, new Map())).toEqual(`export { default as Component } from "./Component.svelte";
export { default } from "./Component.svelte";`);
  });

  test("removeSvelteExt", () => {
    expect(removeSvelteExt("input.svelte")).toEqual("input");
    expect(removeSvelteExt("ComponentName.svelte")).toEqual("ComponentName");
  });

  test("convertSvelteExt", () => {
    expect(convertSvelteExt("input.svelte")).toEqual("input.svelte.d.ts");
    expect(convertSvelteExt("ComponentName.svelte")).toEqual("ComponentName.svelte.d.ts");
  });
});
