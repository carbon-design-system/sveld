import { convertSvelteExt, createExports, removeSvelteExt } from "../src/create-exports";

describe("createExports", () => {
  test("single default export", () => {
    const source = { default: { source: "./Component.svelte", default: true } };

    expect(createExports(source)).toEqual('export { default } from "./Component.svelte";');
  });

  test("single default export (declaration)", () => {
    const source = { Component: { source: "./Component.svelte", default: true } };

    expect(createExports(source)).toEqual('export { default as Component } from "./Component.svelte";');
  });

  test("single named export", () => {
    const source = { Component: { source: "./Component.svelte", default: false } };

    expect(createExports(source)).toEqual('export { default as Component } from "./Component.svelte";');
  });

  test("multiple named exports", () => {
    const source = {
      Component: { source: "./Component.svelte", default: false },
      Component2: { source: "./Component2.svelte", default: false },
    };

    expect(createExports(source)).toEqual(`export { default as Component } from "./Component.svelte";
export { default as Component2 } from "./Component2.svelte";`);
  });

  test("multiple named exports with a default export", () => {
    const source = {
      Component: { source: "./Component.svelte", default: false },
      Component2: { source: "./Component2.svelte", default: false },
      default: { source: "./Component2.svelte", default: true },
    };

    expect(createExports(source)).toEqual(`export { default as Component } from "./Component.svelte";
export { default as Component2 } from "./Component2.svelte";
export { default } from "./Component2.svelte";`);
  });

  test("multiple named exports with a default export (declaration)", () => {
    const source = {
      Component: { source: "./Component.svelte", default: false },
      Component2: { source: "./Component2.svelte", default: false },
      Component3: { source: "./Component3.svelte", default: true },
    };

    expect(createExports(source)).toEqual(`export { default as Component } from "./Component.svelte";
export { default as Component2 } from "./Component2.svelte";
export { default as Component3 } from "./Component3.svelte";`);
  });

  test("mixed exports", () => {
    const source = { Component: { source: "./Component.svelte", default: true, mixed: true } };

    expect(createExports(source)).toEqual(`export { default as Component } from "./Component.svelte";
export { default } from "./Component.svelte";`);
  });

  test("grouped named exports from same source", () => {
    const source = {
      filterTreeNodes: { source: "./utils/filterTreeNodes", default: false },
      filterTreeById: { source: "./utils/filterTreeNodes", default: false },
      filterTreeByText: { source: "./utils/filterTreeNodes", default: false },
    };

    expect(createExports(source)).toEqual(
      'export { filterTreeNodes, filterTreeById, filterTreeByText } from "./utils/filterTreeNodes";',
    );
  });

  test("grouped named exports with multiple sources", () => {
    const source = {
      filterTreeNodes: { source: "./utils/filterTreeNodes", default: false },
      filterTreeById: { source: "./utils/filterTreeNodes", default: false },
      sortTree: { source: "./utils/sortTree", default: false },
      normalizeTree: { source: "./utils/normalizeTree", default: false },
    };

    expect(createExports(source)).toEqual(`export { filterTreeNodes, filterTreeById } from "./utils/filterTreeNodes";
export { sortTree } from "./utils/sortTree";
export { normalizeTree } from "./utils/normalizeTree";`);
  });

  test("grouped named exports with mixed default and named from same source", () => {
    const source = {
      Component: { source: "./Component.svelte", default: true },
      helperA: { source: "./utils/helpers", default: false },
      helperB: { source: "./utils/helpers", default: false },
      helperC: { source: "./utils/helpers", default: false },
    };

    expect(createExports(source)).toEqual(`export { default as Component } from "./Component.svelte";
export { helperA, helperB, helperC } from "./utils/helpers";`);
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
