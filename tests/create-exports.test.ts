import * as test from "tape";
import { convertSvelteExt, createExports, removeSvelteExt } from "../src/create-exports";

test("createExports – single default export", (t) => {
  const source = { default: { source: "./Component.svelte", default: true } };

  t.deepEqual(createExports(source, new Map()), 'export { default } from "./Component.svelte";');
  t.end();
});

test("createExports – single default export (declaration)", (t) => {
  const source = { Component: { source: "./Component.svelte", default: true } };

  t.deepEqual(createExports(source, new Map()), 'export { default } from "./Component.svelte";');
  t.end();
});

test("createExports – single named export", (t) => {
  const source = { Component: { source: "./Component.svelte", default: false } };

  t.deepEqual(createExports(source, new Map()), 'export { default as Component } from "./Component.svelte";');
  t.end();
});

test("createExports – multiple named exports", (t) => {
  const source = {
    Component: { source: "./Component.svelte", default: false },
    Component2: { source: "./Component2.svelte", default: false },
  };

  t.deepEqual(
    createExports(source, new Map()),
    'export { default as Component } from "./Component.svelte";\nexport { default as Component2 } from "./Component2.svelte";'
  );
  t.end();
});

test("createExports – multiple named exports with a default export", (t) => {
  const source = {
    Component: { source: "./Component.svelte", default: false },
    Component2: { source: "./Component2.svelte", default: false },
    default: { source: "./Component2.svelte", default: true },
  };

  t.deepEqual(
    createExports(source, new Map()),
    'export { default as Component } from "./Component.svelte";\nexport { default as Component2 } from "./Component2.svelte";\nexport { default } from "./Component2.svelte";'
  );
  t.end();
});

test("createExports – multiple named exports with a default export (declaration)", (t) => {
  const source = {
    Component: { source: "./Component.svelte", default: false },
    Component2: { source: "./Component2.svelte", default: false },
    Component3: { source: "./Component3.svelte", default: true },
  };

  t.deepEqual(
    createExports(source, new Map()),
    'export { default as Component } from "./Component.svelte";\nexport { default as Component2 } from "./Component2.svelte";\nexport { default } from "./Component3.svelte";'
  );
  t.end();
});

test("createExports – mixed exports", (t) => {
  const source = { Component: { source: "./Component.svelte", default: true, mixed: true } };

  t.deepEqual(
    createExports(source, new Map()),
    'export { default as Component } from "./Component.svelte";\nexport { default } from "./Component.svelte";'
  );
  t.end();
});

test("removeSvelteExt", (t) => {
  t.equal(removeSvelteExt("input.svelte"), "input");
  t.equal(removeSvelteExt("ComponentName.svelte"), "ComponentName");
  t.end();
});

test("convertSvelteExt", (t) => {
  t.equal(convertSvelteExt("input.svelte"), "input.svelte.d.ts");
  t.equal(convertSvelteExt("ComponentName.svelte"), "ComponentName.svelte.d.ts");
  t.end();
});
