// biome-ignore lint/performance/noNamespaceImport: needed for jest.spyOn
import * as fs from "node:fs";
// biome-ignore lint/performance/noNamespaceImport: needed for jest.spyOn
import * as path from "node:path";
import pluginSveld, { generateBundle } from "../src/rollup-plugin";

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

    const result = await generateBundle(mockInput, false);

    // Should NOT attempt to read directory as file
    expect(readFileSyncSpy).not.toHaveBeenCalledWith(mockInput, "utf-8");
    expect(result.exports).toEqual({});
  });

  test("handles directory input with glob option", async () => {
    const mockInput = "/mock/fixtures/src";

    jest.spyOn(fs, "lstatSync").mockReturnValue({ isFile: () => false } as fs.Stats);

    const result = await generateBundle(mockInput, true);

    // Should not crash and should populate exports from glob-discovered components
    expect(result.exports).toBeDefined();
    expect(result.components).toBeDefined();
  });
});
