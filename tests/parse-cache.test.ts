import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import type { ComponentDocApi, ComponentDocs } from "../src/bundle";
import { generateBundle } from "../src/bundle";
import ComponentParser from "../src/ComponentParser";
import { DEFAULT_CACHE_FILE } from "../src/parse-cache";
import writeTsDefinitions from "../src/writer/writer-ts-definitions";

/** Look up `allComponentsForTypes` by filePath; moduleName is not unique. */
function byModuleName(components: ComponentDocs, moduleName: string): ComponentDocApi | undefined {
  return Array.from(components.values()).find((component) => component.moduleName === moduleName);
}

const BUTTON = `<script>
  /** @restProps {button} */
  export let primary = false;
</script>

<button {...$$restProps}><slot /></button>`;

const SECONDARY_BUTTON = `<script>
  /** @extendProps {"./Button.svelte"} ButtonProps */
  export let secondary = true;

  import Button from "./Button.svelte";
</script>

<Button {...$$restProps}><slot /></Button>`;

const STANDALONE = `<script>
  export let label = "standalone";
</script>

<span>{label}</span>`;

describe("parse cache", () => {
  let dir: string;
  let cacheFile: string;
  let parseSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sveld-parse-cache-"));
    cacheFile = join(dir, ".cache", "parse-cache.json");
    writeFileSync(join(dir, "Button.svelte"), BUTTON);
    writeFileSync(join(dir, "SecondaryButton.svelte"), SECONDARY_BUTTON);
    writeFileSync(join(dir, "Standalone.svelte"), STANDALONE);
    parseSpy = jest.spyOn(ComponentParser.prototype, "parseSvelteComponent");
  });

  afterEach(() => {
    parseSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  test("persists a cache file to disk after a run", async () => {
    await generateBundle(dir, true, { cache: cacheFile });

    const cache = JSON.parse(readFileSync(cacheFile, "utf-8"));
    expect(Object.keys(cache.entries).sort()).toEqual(
      [resolve(dir, "Button.svelte"), resolve(dir, "SecondaryButton.svelte"), resolve(dir, "Standalone.svelte")].sort(),
    );
  });

  test("a second run with unchanged sources re-parses nothing", async () => {
    const first = await generateBundle(dir, true, { cache: cacheFile });
    parseSpy.mockClear();

    const second = await generateBundle(dir, true, { cache: cacheFile });

    expect(parseSpy).not.toHaveBeenCalled();
    expect(Array.from(second.allComponentsForTypes.keys()).sort()).toEqual(
      Array.from(first.allComponentsForTypes.keys()).sort(),
    );
    expect(byModuleName(second.allComponentsForTypes, "Button")?.props.map((p) => p.name)).toEqual(
      byModuleName(first.allComponentsForTypes, "Button")?.props.map((p) => p.name),
    );
  });

  test("editing one component only re-parses that component on the next run", async () => {
    await generateBundle(dir, true, { cache: cacheFile });
    parseSpy.mockClear();

    writeFileSync(join(dir, "Standalone.svelte"), STANDALONE.replace('"standalone"', '"changed"'));
    const result = await generateBundle(dir, true, { cache: cacheFile });

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(byModuleName(result.allComponentsForTypes, "Standalone")?.props.find((p) => p.name === "label")?.value).toBe(
      '"changed"',
    );
  });

  test("editing an @extendProps target also invalidates its dependent, even though the dependent's own content is unchanged", async () => {
    await generateBundle(dir, true, { cache: cacheFile });
    parseSpy.mockClear();

    writeFileSync(join(dir, "Button.svelte"), BUTTON.replace("primary = false", "primary = true"));
    await generateBundle(dir, true, { cache: cacheFile });

    const calls = parseSpy.mock.calls as unknown as Array<[string, { filePath: string }]>;
    const reparsedPaths = calls.map(([, diagnostics]) => diagnostics.filePath);
    expect(reparsedPaths.sort()).toEqual(["./Button.svelte", "./SecondaryButton.svelte"].sort());
  });

  test("editing an @extendProps target invalidates its exported dependent exactly once, even though the dependent is also discovered via glob", async () => {
    const entry = join(dir, "entry.js");
    writeFileSync(entry, 'export { default as SecondaryButton } from "./SecondaryButton.svelte";\n');

    // SecondaryButton is now both exported (via the barrel) and glob-discovered,
    // so it lands in both the exported and all-components passes.
    await generateBundle(entry, true, { cache: cacheFile });
    parseSpy.mockClear();

    writeFileSync(join(dir, "Button.svelte"), BUTTON.replace("primary = false", "primary = true"));
    const result = await generateBundle(entry, true, { cache: cacheFile });

    const calls = parseSpy.mock.calls as unknown as Array<[string, { filePath: string }]>;
    const reparsedPaths = calls.map(([, diagnostics]) => diagnostics.filePath);
    // The dependent must be re-parsed once, not once per pass.
    expect(reparsedPaths.sort()).toEqual(["./Button.svelte", "./SecondaryButton.svelte"].sort());
    expect(result.components.has("SecondaryButton")).toBe(true);
    expect(byModuleName(result.allComponentsForTypes, "SecondaryButton")).toBeDefined();
  });

  test("a stale cache from an unrelated project root doesn't leak into a new one", async () => {
    const otherDir = mkdtempSync(join(tmpdir(), "sveld-parse-cache-other-"));
    writeFileSync(join(otherDir, "Standalone.svelte"), STANDALONE);

    try {
      await generateBundle(dir, true, { cache: cacheFile });
      parseSpy.mockClear();

      const result = await generateBundle(otherDir, true, { cache: cacheFile });

      expect(parseSpy).toHaveBeenCalledTimes(1);
      expect(byModuleName(result.allComponentsForTypes, "Standalone")).toBeDefined();
    } finally {
      rmSync(otherDir, { recursive: true, force: true });
    }
  });
});

describe("generated .d.ts text cache", () => {
  let dir: string;
  let outDirAbs: string;
  let outDir: string;
  let cacheFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sveld-text-cache-"));
    // writeTsDefinitions joins its index.d.ts path onto process.cwd() regardless
    // of whether outDir is already absolute, so (as elsewhere in this test suite)
    // outDir must be relative to cwd or writes land under a bogus cwd-nested path.
    outDirAbs = mkdtempSync(join(process.cwd(), ".tmp-sveld-text-cache-out-"));
    outDir = relative(process.cwd(), outDirAbs);
    cacheFile = join(dir, ".cache", "parse-cache.json");
    writeFileSync(join(dir, "Button.svelte"), BUTTON);
    writeFileSync(join(dir, "SecondaryButton.svelte"), SECONDARY_BUTTON);
    writeFileSync(join(dir, "Standalone.svelte"), STANDALONE);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(outDirAbs, { recursive: true, force: true });
  });

  test("a component whose @extendProps target changed is regenerated, not served stale cached text", async () => {
    const secondaryButtonPath = resolve(dir, "SecondaryButton.svelte");
    const standalonePath = resolve(dir, "Standalone.svelte");

    const first = await generateBundle(dir, true, { cache: cacheFile });
    await writeTsDefinitions(first.allComponentsForTypes, {
      outDir,
      inputDir: dir,
      preamble: "",
      exports: first.exports,
      cache: first.cache,
      resolvedPathByFilePath: first.resolvedPathByFilePath,
    });
    first.cache?.save();

    // Both components' generated text is now cached against the first run's parse.
    expect(first.cache?.getGeneratedText(secondaryButtonPath, "class:export-types")).toBeDefined();
    expect(first.cache?.getGeneratedText(standalonePath, "class:export-types")).toBeDefined();

    writeFileSync(join(dir, "Button.svelte"), BUTTON.replace("primary = false", "primary = true"));
    const second = await generateBundle(dir, true, { cache: cacheFile });

    // SecondaryButton depends on Button via @extendProps, so it's invalidated
    // and reparsed even though its own source didn't change; its fresh parse
    // entry must not carry over the stale cached text.
    expect(second.cache?.getGeneratedText(secondaryButtonPath, "class:export-types")).toBeUndefined();
    // Standalone is unrelated and still a parse-cache hit, so its previously
    // cached text is legitimately reused.
    expect(second.cache?.getGeneratedText(standalonePath, "class:export-types")).toBeDefined();
  });

  test("--types-format switch doesn't serve a component's other-format cached text", async () => {
    const buttonPath = resolve(dir, "Button.svelte");

    const first = await generateBundle(dir, true, { cache: cacheFile });
    await writeTsDefinitions(first.allComponentsForTypes, {
      outDir,
      inputDir: dir,
      preamble: "",
      exports: first.exports,
      format: "class",
      cache: first.cache,
      resolvedPathByFilePath: first.resolvedPathByFilePath,
    });
    first.cache?.save();

    const second = await generateBundle(dir, true, { cache: cacheFile });
    expect(second.cache?.getGeneratedText(buttonPath, "class:export-types")).toBeDefined();
    expect(second.cache?.getGeneratedText(buttonPath, "component:export-types")).toBeUndefined();
  });

  test("exportTypes switch doesn't serve a component's other-exportTypes cached text", async () => {
    const buttonPath = resolve(dir, "Button.svelte");

    const first = await generateBundle(dir, true, { cache: cacheFile });
    await writeTsDefinitions(first.allComponentsForTypes, {
      outDir,
      inputDir: dir,
      preamble: "",
      exports: first.exports,
      exportTypes: true,
      cache: first.cache,
      resolvedPathByFilePath: first.resolvedPathByFilePath,
    });
    first.cache?.save();

    const second = await generateBundle(dir, true, { cache: cacheFile });
    expect(second.cache?.getGeneratedText(buttonPath, "class:export-types")).toBeDefined();
    expect(second.cache?.getGeneratedText(buttonPath, "class:no-export-types")).toBeUndefined();
  });
});

describe("cache default", () => {
  let dir: string;
  let parseSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sveld-parse-cache-default-"));
    writeFileSync(join(dir, "Standalone.svelte"), STANDALONE);
    parseSpy = jest.spyOn(ComponentParser.prototype, "parseSvelteComponent");
  });

  afterEach(() => {
    parseSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  test("with no cache option, writes to the default path and hits it on the next run", async () => {
    await generateBundle(dir, true);

    expect(existsSync(join(dir, DEFAULT_CACHE_FILE))).toBe(true);

    parseSpy.mockClear();
    const second = await generateBundle(dir, true);

    expect(parseSpy).not.toHaveBeenCalled();
    expect(byModuleName(second.allComponentsForTypes, "Standalone")).toBeDefined();
  });

  test("cache: false disables the cache entirely", async () => {
    await generateBundle(dir, true, { cache: false });

    expect(existsSync(join(dir, DEFAULT_CACHE_FILE))).toBe(false);
  });
});
