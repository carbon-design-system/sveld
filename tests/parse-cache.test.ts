import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateBundle } from "../src/bundle";
import ComponentParser from "../src/ComponentParser";
import { DEFAULT_CACHE_FILE } from "../src/parse-cache";

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
    expect(second.allComponentsForTypes.get("Button")?.props.map((p) => p.name)).toEqual(
      first.allComponentsForTypes.get("Button")?.props.map((p) => p.name),
    );
  });

  test("editing one component only re-parses that component on the next run", async () => {
    await generateBundle(dir, true, { cache: cacheFile });
    parseSpy.mockClear();

    writeFileSync(join(dir, "Standalone.svelte"), STANDALONE.replace('"standalone"', '"changed"'));
    const result = await generateBundle(dir, true, { cache: cacheFile });

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(result.allComponentsForTypes.get("Standalone")?.props.find((p) => p.name === "label")?.value).toBe(
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

  test("a stale cache from an unrelated project root doesn't leak into a new one", async () => {
    const otherDir = mkdtempSync(join(tmpdir(), "sveld-parse-cache-other-"));
    writeFileSync(join(otherDir, "Standalone.svelte"), STANDALONE);

    try {
      await generateBundle(dir, true, { cache: cacheFile });
      parseSpy.mockClear();

      const result = await generateBundle(otherDir, true, { cache: cacheFile });

      expect(parseSpy).toHaveBeenCalledTimes(1);
      expect(result.allComponentsForTypes.has("Standalone")).toBe(true);
    } finally {
      rmSync(otherDir, { recursive: true, force: true });
    }
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
    expect(second.allComponentsForTypes.has("Standalone")).toBe(true);
  });

  test("cache: false disables the cache entirely", async () => {
    await generateBundle(dir, true, { cache: false });

    expect(existsSync(join(dir, DEFAULT_CACHE_FILE))).toBe(false);
  });
});
