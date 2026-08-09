// biome-ignore lint/performance/noNamespaceImport: needed for jest.spyOn
import * as fs from "node:fs";
// biome-ignore lint/performance/noNamespaceImport: needed for jest.spyOn
import * as path from "node:path";
import type { ComponentDocs, GenerateBundleResult } from "../src/plugin";
import pluginSveld, { generateBundle, writeOutput } from "../src/plugin";
import { registerWriter } from "../src/writer/registry";
import { mockComponentDocApi } from "./test-brands";

describe("pluginSveld", () => {
  const mockCwd = "/mock/project";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, "cwd").mockReturnValue(mockCwd);
    jest.spyOn(path, "join").mockImplementation((...args) => args.join("/"));
    jest.spyOn(fs, "existsSync");
    jest.spyOn(fs, "readFileSync");
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("uses explicit entry option when provided", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);

    const plugin = pluginSveld({ entry: "src/CustomEntry.svelte" });
    plugin.buildStart?.call({});

    expect(fs.existsSync).toHaveBeenCalledWith(`${mockCwd}/src/CustomEntry.svelte`);
  });

  test("falls back to package.json svelte field when no entry option", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({ svelte: "src/index.js" }));

    const plugin = pluginSveld();
    plugin.buildStart?.call({});

    expect(fs.readFileSync).toHaveBeenCalledWith(`${mockCwd}/package.json`, "utf-8");
  });

  test("entry option takes precedence over package.json", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({ svelte: "src/index.js" }));

    const plugin = pluginSveld({ entry: "src/Override.svelte" });
    plugin.buildStart?.call({});

    expect(fs.existsSync).toHaveBeenCalledWith(`${mockCwd}/src/Override.svelte`);
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });
});

describe("generateBundle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("handles directory input without crashing (issue #94)", async () => {
    const mockInput = "/mock/fixtures/src";

    jest.spyOn(fs, "lstatSync").mockReturnValue({ isFile: () => false } as fs.Stats);
    const readFileSyncSpy = jest.spyOn(fs, "readFileSync");

    const result = await generateBundle(mockInput, false, { cache: false });

    // Should NOT attempt to read directory as file
    expect(readFileSyncSpy).not.toHaveBeenCalledWith(mockInput, "utf-8");
    expect(result.exports).toEqual({});
  });

  test("handles directory input with glob option", async () => {
    const mockInput = "/mock/fixtures/src";

    jest.spyOn(fs, "lstatSync").mockReturnValue({ isFile: () => false } as fs.Stats);

    const result = await generateBundle(mockInput, true, { cache: false });

    // Should not crash and should populate exports from glob-discovered components
    expect(result.exports).toBeDefined();
    expect(result.components).toBeDefined();
  });

  describe("documentExports", () => {
    const entryFile = path.join(process.cwd(), "tests", "fixtures-entry-exports", "entry.js");

    test("does not document entry exports by default", async () => {
      const result = await generateBundle(entryFile, false, { cache: false });
      expect(result.entryExports).toEqual([]);
    });

    test("documents non-component entry exports when enabled", async () => {
      const result = await generateBundle(entryFile, false, { documentExports: true, cache: false });
      const byName = new Map(result.entryExports.map((entry) => [entry.name, entry]));

      // Components are excluded from the entry exports collection.
      expect(byName.has("Button")).toBe(false);

      expect(byName.get("VERSION")).toMatchObject({ kind: "const", type: "string" });
      expect(byName.get("clamp")).toMatchObject({ kind: "function" });
      expect(byName.get("Theme")).toMatchObject({ kind: "type", isTypeOnly: true });
    });
  });
});

describe("writeOutput additionalWriters", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('componentSet: "all" gets allComponentsForTypes, keyed by filePath so colliding moduleNames both survive', async () => {
    let received: ComponentDocs | undefined;
    registerWriter({
      name: "test-all-componentset-writer",
      componentSet: "all",
      write: (components) => {
        received = components;
      },
    });

    // Two --glob-discovered components sharing a basename in different
    // directories, same shape as the collision #402 fixed.
    const allComponentsForTypes: ComponentDocs = new Map([
      ["Menu/Menu.svelte", mockComponentDocApi("Menu", "Menu/Menu.svelte")],
      ["icons/Menu.svelte", mockComponentDocApi("Menu", "icons/Menu.svelte")],
    ]);

    const result: GenerateBundleResult = {
      exports: {},
      entryExports: [],
      components: new Map(),
      allComponentsForTypes,
      errors: [],
      diagnostics: [],
    };

    await writeOutput(
      result,
      { types: false, additionalWriters: { "test-all-componentset-writer": {} } },
      "/mock/src/index.js",
    );

    // The custom writer sees the same, filePath-keyed map: both "Menu"
    // components are present, not collapsed into one via moduleName.
    expect(received).toBe(allComponentsForTypes);
    expect(received?.size).toBe(2);
    expect(Array.from(received?.values() ?? []).map((component) => component.moduleName)).toEqual(["Menu", "Menu"]);
  });

  test('componentSet: "exported" (the default) gets components, not allComponentsForTypes', async () => {
    let received: ComponentDocs | undefined;
    registerWriter({
      name: "test-exported-componentset-writer",
      write: (components) => {
        received = components;
      },
    });

    const components: ComponentDocs = new Map([["Button", mockComponentDocApi("Button", "Button.svelte")]]);

    const result: GenerateBundleResult = {
      exports: {},
      entryExports: [],
      components,
      allComponentsForTypes: new Map(),
      errors: [],
      diagnostics: [],
    };

    await writeOutput(
      result,
      { types: false, additionalWriters: { "test-exported-componentset-writer": {} } },
      "/mock/src/index.js",
    );

    expect(received).toBe(components);
  });
});
