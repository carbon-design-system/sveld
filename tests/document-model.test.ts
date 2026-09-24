import type { ComponentDocs } from "../src/plugin";
import { buildComponentApiDocument } from "../src/writer/document-model";
import { mockComponentDocApi } from "./test-brands";

describe("buildComponentApiDocument caching", () => {
  test("returns the same document instance for repeat calls with the same components and entryExports", () => {
    const components: ComponentDocs = new Map([["Alpha", mockComponentDocApi("Alpha", "Alpha.svelte")]]);

    const first = buildComponentApiDocument(components);
    const second = buildComponentApiDocument(components);

    expect(second).toBe(first);
  });

  test("does not reuse the document across different entryExports references", () => {
    const components: ComponentDocs = new Map([["Alpha", mockComponentDocApi("Alpha", "Alpha.svelte")]]);
    const entryExports = [
      { name: "VERSION", kind: "const" as const, type: "string", isTypeOnly: false, source: "./constants.ts" },
    ];

    const withoutExports = buildComponentApiDocument(components);
    const withExports = buildComponentApiDocument(components, { entryExports });

    expect(withExports).not.toBe(withoutExports);
    expect(withExports.totalExports).toBe(1);
    expect(withoutExports.totalExports).toBeUndefined();

    // Same entryExports reference on a later call still hits the cache.
    expect(buildComponentApiDocument(components, { entryExports })).toBe(withExports);
  });

  test("does not reuse the document across different components maps", () => {
    const components: ComponentDocs = new Map([["Alpha", mockComponentDocApi("Alpha", "Alpha.svelte")]]);
    const otherComponents: ComponentDocs = new Map([["Beta", mockComponentDocApi("Beta", "Beta.svelte")]]);

    const first = buildComponentApiDocument(components);
    const second = buildComponentApiDocument(otherComponents);

    expect(second).not.toBe(first);
    expect(second.components.map((c) => c.moduleName)).toEqual(["Beta"]);
  });
});

describe("buildComponentApiDocument ordering", () => {
  test("sorts components the same way whatever the machine locale", () => {
    const original = String.prototype.localeCompare;
    const czech = new Intl.Collator("cs");
    // Czech collation sorts "ch" after "h", so a locale-following sort would put Hover first.
    String.prototype.localeCompare = function (this: string, that: string) {
      return czech.compare(this, that);
    };
    try {
      const components: ComponentDocs = new Map([
        ["Hover", mockComponentDocApi("Hover", "Hover.svelte")],
        ["Change", mockComponentDocApi("Change", "Change.svelte")],
      ]);
      expect(buildComponentApiDocument(components).components.map((c) => c.moduleName)).toEqual(["Change", "Hover"]);
    } finally {
      String.prototype.localeCompare = original;
    }
  });
});
