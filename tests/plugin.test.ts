// biome-ignore lint/performance/noNamespaceImport: needed for jest.spyOn
import * as fs from "node:fs";
import { tmpdir } from "node:os";
// biome-ignore lint/performance/noNamespaceImport: needed for jest.spyOn
import * as path from "node:path";
import type { GenerateBundleResult } from "../src/plugin";
import pluginSveld, { generateBundle, writeOutput } from "../src/plugin";
import { mockComponentDocApi } from "./test-brands";

/** Mock Rollup plugin context: throws (instead of `never`-returning) so `this.error(...)` surfaces as a rejected promise. */
const errorContext = {
  error: (message: string) => {
    throw new Error(message);
  },
};

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

  test("generateBundle hook calls this.error when the entry cannot be resolved", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    const plugin = pluginSveld();
    await plugin.buildStart?.call({});

    const errorSpy = jest.fn((message: string) => {
      throw new Error(message);
    });

    await expect(plugin.generateBundle.call({ error: errorSpy })).rejects.toThrow(
      "sveld: could not resolve a Svelte entry point",
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("sveld: could not resolve a Svelte entry point"));
  });

  test("writeBundle hook calls this.error when the entry cannot be resolved", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    const plugin = pluginSveld();
    await plugin.buildStart?.call({});

    const errorSpy = jest.fn((message: string) => {
      throw new Error(message);
    });

    await expect(plugin.writeBundle.call({ error: errorSpy })).rejects.toThrow(
      "sveld: could not resolve a Svelte entry point",
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("sveld: could not resolve a Svelte entry point"));
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

describe("writeOutput output paths", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(tmpdir(), "sveld-abs-out-"));
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("writes every built-in output to an absolute path as given, not under cwd", async () => {
    const button = mockComponentDocApi("Button", "Button.svelte");
    const result: GenerateBundleResult = {
      exports: { Button: { source: "./Button.svelte", default: true } },
      entryExports: [],
      components: new Map([["Button", button]]),
      allComponentsForTypes: new Map([["Button.svelte", button]]),
      errors: [],
      diagnostics: [],
    };

    await writeOutput(
      result,
      {
        types: true,
        typesOptions: { outDir: path.join(dir, "types") },
        json: true,
        jsonOptions: { outFile: path.join(dir, "api.json") },
        markdown: true,
        markdownOptions: { outFile: path.join(dir, "index.md") },
        customElements: true,
        customElementsOptions: { outFile: path.join(dir, "custom-elements.json") },
        llms: true,
        llmsOptions: { outDir: path.join(dir, "llms") },
      },
      path.join(dir, "index.js"),
    );

    for (const file of [
      "types/index.d.ts",
      "types/Button.svelte.d.ts",
      "api.json",
      "index.md",
      "custom-elements.json",
      "llms/llms.txt",
      "llms/llms-full.txt",
    ]) {
      expect(fs.existsSync(path.join(dir, file))).toBe(true);
    }
  });
});

describe("pluginSveld config option", () => {
  const BUTTON = `<script>\n  export let label = "button";\n</script>\n\n<button>{label}</button>`;

  let dir: string;
  let previousCwd: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(tmpdir(), "sveld-plugin-config-"));
    fs.writeFileSync(path.join(dir, "Button.svelte"), BUTTON);
    previousCwd = process.cwd();
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function runBuild(plugin: ReturnType<typeof pluginSveld>) {
    await plugin.buildStart();
    await plugin.generateBundle.call(errorContext);
    await plugin.writeBundle.call(errorContext);
  }

  test("config: false (the default) ignores a config file present in cwd", async () => {
    fs.writeFileSync(path.join(dir, "sveld.config.mjs"), "export default { json: true };");
    const plugin = pluginSveld({ entry: ".", glob: true, types: false });

    await runBuild(plugin);

    expect(fs.existsSync(path.join(dir, "COMPONENT_API.json"))).toBe(false);
  });

  test("warns about config keys only the CLI and sveld() act on", async () => {
    fs.writeFileSync(
      path.join(dir, "sveld.config.mjs"),
      "export default { json: true, strict: true, check: true, reportDiagnostics: true };",
    );
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const plugin = pluginSveld({ entry: ".", glob: true, types: false, config: true });

    await runBuild(plugin);

    expect(warnSpy).toHaveBeenCalledWith(
      'sveld: the Vite plugin ignores "reportDiagnostics", "strict", "check"; run the sveld CLI or sveld() for them.',
    );
    warnSpy.mockRestore();
  });

  test("config: true loads sveld.config.mjs and applies its options", async () => {
    fs.writeFileSync(path.join(dir, "sveld.config.mjs"), "export default { json: true };");
    const plugin = pluginSveld({ entry: ".", glob: true, types: false, config: true });

    await runBuild(plugin);

    expect(fs.existsSync(path.join(dir, "COMPONENT_API.json"))).toBe(true);
  });

  test("call-site options take precedence over the same key in the config file", async () => {
    fs.writeFileSync(path.join(dir, "sveld.config.mjs"), "export default { json: true };");
    const plugin = pluginSveld({ entry: ".", glob: true, types: false, config: true, json: false });

    await runBuild(plugin);

    expect(fs.existsSync(path.join(dir, "COMPONENT_API.json"))).toBe(false);
  });
});
