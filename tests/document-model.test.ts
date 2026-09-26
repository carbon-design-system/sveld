import type { ComponentDocs } from "../src/plugin";
import { buildComponentApiDocument } from "../src/writer/document-model";
import { mockComponentDocApi } from "./test-brands";

describe("buildComponentApiDocument freshness", () => {
  test("reflects a components map mutated in place between calls", () => {
    // Watch mode keeps one map per bundle and updates it in place, so a
    // document cached on the map's identity would go stale after the
    // first write.
    const components: ComponentDocs = new Map([["Alpha", mockComponentDocApi("Alpha", "Alpha.svelte")]]);
    expect(buildComponentApiDocument(components).components.map((c) => c.moduleName)).toEqual(["Alpha"]);

    components.set("Beta", mockComponentDocApi("Beta", "Beta.svelte"));
    expect(buildComponentApiDocument(components).components.map((c) => c.moduleName)).toEqual(["Alpha", "Beta"]);
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
