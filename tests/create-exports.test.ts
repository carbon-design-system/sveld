import * as test from "tape";
import { convertSvelteExt, createExports, removeSvelteExt } from "../src/create-exports";

test("createExports – single default export", (t) => {
  const source = { default: { source: "./Component.svelte", default: true } };

  t.deepEqual(createExports(source), 'export { default } from "./Component";');
  t.end();
});

test("createExports – single default export (declaration)", (t) => {
  const source = { Component: { source: "./Component.svelte", default: true } };

  t.deepEqual(createExports(source), 'export { default } from "./Component";');
  t.end();
});

test("createExports – single named export", (t) => {
  const source = { Component: { source: "./Component.svelte", default: false } };

  t.deepEqual(createExports(source), 'export { default as Component } from "./Component";');
  t.end();
});

test("createExports – multiple named exports", (t) => {
  const source = {
    Component: { source: "./Component.svelte", default: false },
    Component2: { source: "./Component2.svelte", default: false },
  };

  t.deepEqual(
    createExports(source),
    'export { default as Component } from "./Component";\nexport { default as Component2 } from "./Component2";'
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
    createExports(source),
    'export { default as Component } from "./Component";\nexport { default as Component2 } from "./Component2";\nexport { default } from "./Component2";'
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
    createExports(source),
    'export { default as Component } from "./Component";\nexport { default as Component2 } from "./Component2";\nexport { default } from "./Component3";'
  );
  t.end();
});

test("createExports – mixed exports", (t) => {
  const source = { Component: { source: "./Component.svelte", default: true, mixed: true } };

  t.deepEqual(
    createExports(source),
    'export { default as Component } from "./Component";\nexport { default } from "./Component";'
  );
  t.end();
});

test("removeSvelteExt", (t) => {
  t.equal(removeSvelteExt("input.svelte"), "input");
  t.equal(removeSvelteExt("ComponentName.svelte"), "ComponentName");
  t.end();
});

test("convertSvelteExt", (t) => {
  t.equal(convertSvelteExt("input.svelte"), "input.d.ts");
  t.equal(convertSvelteExt("ComponentName.svelte"), "ComponentName.d.ts");
  t.end();
});
