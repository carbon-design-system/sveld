import { convertSvelteExt, createExports, removeSvelteExt } from "../src/create-exports";
import { mockParsedExport, mockParsedExports } from "./test-brands";

describe("createExports", () => {
  test("single default export", () => {
    const source = mockParsedExports({
      default: mockParsedExport("./Component.svelte", { default: true }),
    });

    expect(createExports(source)).toEqual('export { default } from "./Component.svelte";');
  });

  test("single default export (declaration)", () => {
    const source = mockParsedExports({
      Component: mockParsedExport("./Component.svelte", { default: true }),
    });

    expect(createExports(source)).toEqual('export { default as Component } from "./Component.svelte";');
  });

  test("single named export", () => {
    const source = mockParsedExports({
      Component: mockParsedExport("./Component.svelte"),
    });

    expect(createExports(source)).toEqual('export { default as Component } from "./Component.svelte";');
  });

  test("multiple named exports", () => {
    const source = mockParsedExports({
      Component: mockParsedExport("./Component.svelte"),
      Component2: mockParsedExport("./Component2.svelte"),
    });

    expect(createExports(source)).toEqual(`export { default as Component } from "./Component.svelte";
export { default as Component2 } from "./Component2.svelte";`);
  });

  test("multiple named exports with a default export", () => {
    const source = mockParsedExports({
      Component: mockParsedExport("./Component.svelte"),
      Component2: mockParsedExport("./Component2.svelte"),
      default: mockParsedExport("./Component2.svelte", { default: true }),
    });

    expect(createExports(source)).toEqual(`export { default as Component } from "./Component.svelte";
export { default as Component2 } from "./Component2.svelte";
export { default } from "./Component2.svelte";`);
  });

  test("multiple named exports with a default export (declaration)", () => {
    const source = mockParsedExports({
      Component: mockParsedExport("./Component.svelte"),
      Component2: mockParsedExport("./Component2.svelte"),
      Component3: mockParsedExport("./Component3.svelte", { default: true }),
    });

    expect(createExports(source)).toEqual(`export { default as Component } from "./Component.svelte";
export { default as Component2 } from "./Component2.svelte";
export { default as Component3 } from "./Component3.svelte";`);
  });

  test("mixed exports", () => {
    const source = mockParsedExports({
      Component: mockParsedExport("./Component.svelte", { default: true, mixed: true }),
    });

    expect(createExports(source)).toEqual(`export { default as Component } from "./Component.svelte";
export { default } from "./Component.svelte";`);
  });

  test("grouped named exports from same source", () => {
    const source = mockParsedExports({
      filterTreeNodes: mockParsedExport("./utils/filterTreeNodes"),
      filterTreeById: mockParsedExport("./utils/filterTreeNodes"),
      filterTreeByText: mockParsedExport("./utils/filterTreeNodes"),
    });

    expect(createExports(source)).toEqual(
      'export { filterTreeNodes, filterTreeById, filterTreeByText } from "./utils/filterTreeNodes";',
    );
  });

  test("grouped named exports with multiple sources", () => {
    const source = mockParsedExports({
      filterTreeNodes: mockParsedExport("./utils/filterTreeNodes"),
      filterTreeById: mockParsedExport("./utils/filterTreeNodes"),
      sortTree: mockParsedExport("./utils/sortTree"),
      normalizeTree: mockParsedExport("./utils/normalizeTree"),
    });

    expect(createExports(source)).toEqual(`export { filterTreeNodes, filterTreeById } from "./utils/filterTreeNodes";
export { sortTree } from "./utils/sortTree";
export { normalizeTree } from "./utils/normalizeTree";`);
  });

  test("grouped named exports with mixed default and named from same source", () => {
    const source = mockParsedExports({
      Component: mockParsedExport("./Component.svelte", { default: true }),
      helperA: mockParsedExport("./utils/helpers"),
      helperB: mockParsedExport("./utils/helpers"),
      helperC: mockParsedExport("./utils/helpers"),
    });

    expect(createExports(source)).toEqual(`export { default as Component } from "./Component.svelte";
export { helperA, helperB, helperC } from "./utils/helpers";`);
  });

  test("default and named export from same Svelte file (module context)", () => {
    const source = mockParsedExports({
      Theme: mockParsedExport("./Theme/Theme.svelte", { default: true }),
      themes: mockParsedExport("./Theme/Theme.svelte"),
    });

    expect(createExports(source)).toEqual('export { default as Theme, themes } from "./Theme/Theme.svelte";');
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
