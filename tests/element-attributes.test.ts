// @reads node_modules/svelte/elements.d.ts
import { readElementAttributes } from "../scripts/element-attributes";
import { COMMON_ATTRIBUTES, TAG_ATTRIBUTES } from "../src/element-attributes";

test("covers the installed svelte/elements (bun scripts/element-attributes.ts)", () => {
  const installed = readElementAttributes();
  expect(Object.keys(TAG_ATTRIBUTES).sort()).toEqual(Object.keys(installed.byTag).sort());
  for (const [tag, names] of Object.entries(installed.byTag)) {
    const missing = [...installed.common, ...names].filter(
      (name) => !COMMON_ATTRIBUTES.has(name) && !TAG_ATTRIBUTES[tag]?.includes(name),
    );
    expect({ tag, missing }).toEqual({ tag, missing: [] });
  }
});

test("keeps what a prop can be named, by tag", () => {
  expect(COMMON_ATTRIBUTES.has("title")).toBe(true);
  expect(TAG_ATTRIBUTES.img).toContain("width");
  expect(TAG_ATTRIBUTES.div).not.toContain("width");
  for (const name of ["tag", "ref", "aria-label", "on:click"]) {
    expect(COMMON_ATTRIBUTES.has(name)).toBe(false);
  }
});
