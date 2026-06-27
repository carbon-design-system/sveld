import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateBundle } from "../src/plugin";

const VALID_COMPONENT = `<script>
  /** @type {string} */
  export let label = "ok";
</script>
<button>{label}</button>`;

/**
 * Unterminated JS expression in the script block — `compile()` throws a
 * `js_parse_error`, which previously aborted the entire run.
 */
const BROKEN_COMPONENT = `<script>
  export let value = ;
</script>
<div>{#if}</div>`;

describe("generateBundle per-component error isolation", () => {
  let dir: string;
  let errorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-errors-"));
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  test("default: a broken component is captured and the rest still emit output", async () => {
    writeFileSync(path.join(dir, "Valid.svelte"), VALID_COMPONENT);
    writeFileSync(path.join(dir, "Broken.svelte"), BROKEN_COMPONENT);

    const result = await generateBundle(dir, true);

    // The valid component is parsed and present in the output.
    expect(result.allComponentsForTypes.has("Valid")).toBe(true);
    // The broken component is absent from the output but recorded as an error.
    expect(result.allComponentsForTypes.has("Broken")).toBe(false);
    expect(result.errors).toHaveLength(1);

    const [error] = result.errors;
    expect(error.moduleName).toBe("Broken");
    expect(error.filePath).toContain("Broken.svelte");
    expect(error.message).toBeTruthy();

    // The failure is reported to the diagnostics surface (stderr).
    expect(errorSpy).toHaveBeenCalled();
  });

  test("errors are deduped across the exported and all-components passes", async () => {
    writeFileSync(path.join(dir, "Broken.svelte"), BROKEN_COMPONENT);

    const result = await generateBundle(dir, true);

    expect(result.errors).toHaveLength(1);
  });

  test("failFast: aborts on the first parse failure", async () => {
    writeFileSync(path.join(dir, "Valid.svelte"), VALID_COMPONENT);
    writeFileSync(path.join(dir, "Broken.svelte"), BROKEN_COMPONENT);

    await expect(generateBundle(dir, true, { failFast: true })).rejects.toThrow();
  });

  test("no errors when all components parse", async () => {
    writeFileSync(path.join(dir, "Valid.svelte"), VALID_COMPONENT);

    const result = await generateBundle(dir, true);

    expect(result.errors).toHaveLength(0);
    expect(result.allComponentsForTypes.has("Valid")).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
