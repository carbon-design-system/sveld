import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateBundle } from "../src/bundle";
import ComponentParser from "../src/ComponentParser";

const BUTTON = `<script>
  export let label = "button";
</script>

<button>{label}</button>`;

describe("generateBundle in-run parse dedupe", () => {
  let dir: string;
  let parseSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sveld-bundle-dedupe-"));
    writeFileSync(join(dir, "Button.svelte"), BUTTON);
    writeFileSync(join(dir, "entry.js"), 'export { default as Button } from "./Button.svelte";\n');
    parseSpy = jest.spyOn(ComponentParser.prototype, "parseSvelteComponent");
  });

  afterEach(() => {
    parseSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a component that is both exported and glob-discovered is parsed exactly once per run", async () => {
    const result = await generateBundle(join(dir, "entry.js"), true);

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(result.components.has("Button")).toBe(true);
    expect(result.allComponentsForTypes.has("Button")).toBe(true);
  });

  test("dedupes the same way when the on-disk cache is enabled", async () => {
    const cacheFile = join(dir, ".cache", "parse-cache.json");
    const result = await generateBundle(join(dir, "entry.js"), true, { cache: cacheFile });

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(result.components.has("Button")).toBe(true);
    expect(result.allComponentsForTypes.has("Button")).toBe(true);
  });
});
