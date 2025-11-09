// biome-ignore lint/performance/noNamespaceImport: needed for jest.spyOn
import * as fs from "node:fs";
// biome-ignore lint/performance/noNamespaceImport: needed for jest.spyOn
import * as path from "node:path";
import pluginSveld from "../src/rollup-plugin";

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
