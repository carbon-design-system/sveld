import * as test from "tape";
import { parseExports } from "../src/parse-exports";

test("parseExports – single default export", (t) => {
  const source = `export { default } from "./Component.svelte";`;

  t.deepEqual(parseExports(source), { default: { source: "./Component.svelte", default: true } });
  t.end();
});

test("parseExports – single default export (declaration)", (t) => {
  const source = `
    import Component from "./Component.svelte";
    export default Component;`;

  t.deepEqual(parseExports(source), {
    Component: { source: "./Component.svelte", default: true },
  });
  t.end();
});

test("parseExports – single named export", (t) => {
  const source = `export { default as Component } from "./Component.svelte";`;

  t.deepEqual(parseExports(source), {
    Component: { source: "./Component.svelte", default: false },
  });
  t.end();
});

test("parseExports – multiple named exports", (t) => {
  const source = `
    export { default as Component } from "./Component.svelte";
    export { default as Component2 } from "./Component2.svelte";`;

  t.deepEqual(parseExports(source), {
    Component: { source: "./Component.svelte", default: false },
    Component2: { source: "./Component2.svelte", default: false },
  });
  t.end();
});

test("parseExports – multiple named exports with a default export", (t) => {
  const source = `
    export { default as Component } from "./Component.svelte";
    export { default as Component2 } from "./Component2.svelte";
    export { default } from "./Component2.svelte";`;

  t.deepEqual(parseExports(source), {
    Component: { source: "./Component.svelte", default: false },
    Component2: { source: "./Component2.svelte", default: false },
    default: { source: "./Component2.svelte", default: true },
  });
  t.end();
});

test("parseExports – multiple named exports with a default export (declaration)", (t) => {
  const source = `
    export { default as Component } from "./Component.svelte";
    export { default as Component2 } from "./Component2.svelte";

    import Component3 from "./Component3.svelte";
    export default Component3;`;

  t.deepEqual(parseExports(source), {
    Component: { source: "./Component.svelte", default: false },
    Component2: { source: "./Component2.svelte", default: false },
    Component3: { source: "./Component3.svelte", default: true },
  });
  t.end();
});
