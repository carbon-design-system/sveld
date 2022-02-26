import { describe, test, expect } from "vitest";
import { parseExports } from "../src/parse-exports";

describe("parseExports", () => {
  test("single default export", () => {
    const source = `export { default } from "./Component.svelte";`;

    expect(parseExports(source)).toEqual({
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

    expect(parseExports(source)).toEqual({
      Component: {
        source: "./Component.svelte",
        default: true,
      },
    });
  });

  test("single named export", () => {
    const source = `export { default as Component } from "./Component.svelte";`;

    expect(parseExports(source)).toEqual({
      Component: {
        source: "./Component.svelte",
        default: false,
      },
    });
  });

  test("multiple named exports", () => {
    const source = `
    export { default as Component } from "./Component.svelte";
    export { default as Component2 } from "./Component2.svelte";`;

    expect(parseExports(source)).toEqual({
      Component: { source: "./Component.svelte", default: false },
      Component2: { source: "./Component2.svelte", default: false },
    });
  });

  test("multiple named exports with a default export", () => {
    const source = `
    export { default as Component } from "./Component.svelte";
    export { default as Component2 } from "./Component2.svelte";
    export { default } from "./Component2.svelte";`;

    expect(parseExports(source)).toEqual({
      Component: { source: "./Component.svelte", default: false },
      Component2: { source: "./Component2.svelte", default: false },
      default: { source: "./Component2.svelte", default: true },
    });
  });

  test("multiple named exports with a default export (declaration)", () => {
    const source = `
    export { default as Component } from "./Component.svelte";
    export { default as Component2 } from "./Component2.svelte";

    import Component3 from "./Component3.svelte";
    export default Component3;`;

    expect(parseExports(source)).toEqual({
      Component: { source: "./Component.svelte", default: false },
      Component2: { source: "./Component2.svelte", default: false },
      Component3: { source: "./Component3.svelte", default: true },
    });
  });

  test("mixed exports", () => {
    const source = `
    import Component from "./Component.svelte";

    export { Component };
    export default Component;`;

    expect(parseExports(source)).toEqual({
      Component: {
        source: "./Component.svelte",
        default: true,
        mixed: true,
      },
    });
  });

  test("multiple, non-default exports", () => {
    const source = `export { Component, Component2 } from "./component";`;

    expect(parseExports(source)).toEqual({
      Component: { source: "./component", default: false },
      Component2: { source: "./component", default: false },
    });
  });
});
