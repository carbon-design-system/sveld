import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { sveld } from "../src/sveld";
import { buildComponentApiDocument } from "../src/writer/document-model";
import { mockComponentDocApi } from "./test-brands";

const ENTRY_ERROR = /entry/i;
const INPUT_RENAMED_ERROR = /renamed to `entry`/;

describe("sveld() entry resolution failures", () => {
  let dir: string;
  let previousCwd: string;

  beforeEach(() => {
    previousCwd = process.cwd();
    dir = mkdtempSync(join(tmpdir(), "sveld-entry-"));
    process.chdir(dir);
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(dir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("throws when the given entry does not resolve", async () => {
    await expect(sveld({ entry: "does-not-exist/" })).rejects.toThrow(ENTRY_ERROR);
  });

  test("throws when no entry is given and package.json#svelte is absent", async () => {
    await expect(sveld()).rejects.toThrow(ENTRY_ERROR);
  });

  test("throws when the removed `input` option is passed", async () => {
    const legacyOpts = { input: "./src" } as unknown as Parameters<typeof sveld>[0];
    await expect(sveld(legacyOpts)).rejects.toThrow(INPUT_RENAMED_ERROR);
  });
});

describe("sveld() check", () => {
  // `getSvelteEntry` resolves `entry` against `process.cwd()`, so the fixture
  // lives under cwd and is referenced by its relative directory name.
  let absoluteDir: string;
  let relativeDir: string;

  let entry: string;

  beforeEach(() => {
    absoluteDir = mkdtempSync(join(process.cwd(), "sveld-check-"));
    relativeDir = basename(absoluteDir);
    entry = join(relativeDir, "index.js");
    writeFileSync(
      join(absoluteDir, "Button.svelte"),
      "<script>\n  export let label;\n</script>\n<button>{label}</button>\n",
    );
    writeFileSync(
      join(absoluteDir, "index.js"),
      'import Button from "./Button.svelte";\n\nexport { Button };\nexport default Button;\n',
    );
  });

  afterEach(() => {
    rmSync(absoluteDir, { recursive: true, force: true });
  });

  test("populates result.check when a snapshot exists", async () => {
    const snapshotFile = join(relativeDir, "COMPONENT_API.json");
    const snapshot = buildComponentApiDocument(
      new Map([["Button", mockComponentDocApi("Button", "Button.svelte", { props: [] })]]),
    );
    writeFileSync(join(absoluteDir, "COMPONENT_API.json"), JSON.stringify(snapshot));

    const result = await sveld({ entry, types: false, check: snapshotFile });

    expect(result.check).toBeDefined();
    expect(result.check?.snapshotExists).toBe(true);
    expect(result.check?.changes).toContainEqual(
      expect.objectContaining({ component: "Button", kind: "prop", name: "label" }),
    );
  });

  test("does not run check when the option is omitted", async () => {
    const result = await sveld({ entry, types: false });

    expect(result.check).toBeUndefined();
  });
});

describe("sveld() exitCode and errors", () => {
  let absoluteDir: string;
  let relativeDir: string;
  let entry: string;
  let previousExitCode: number | string | undefined;

  beforeEach(() => {
    absoluteDir = mkdtempSync(join(process.cwd(), "sveld-exitcode-"));
    relativeDir = basename(absoluteDir);
    entry = join(relativeDir, "index.js");
    previousExitCode = process.exitCode;
    process.exitCode = 0;
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = previousExitCode;
    rmSync(absoluteDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test("never mutates process.exitCode, even with strict diagnostics", async () => {
    writeFileSync(
      join(absoluteDir, "Phantom.svelte"),
      "<script>\n  /** @event {CustomEvent<null>} phantom */\n  export let label;\n</script>\n<button>{label}</button>\n",
    );
    writeFileSync(join(absoluteDir, "index.js"), 'export { default as Phantom } from "./Phantom.svelte";\n');

    const result = await sveld({ entry, types: false, strict: true });

    expect(process.exitCode).toBe(0);
    expect(result.exitCode).toBe(4);
  });

  test("result.exitCode is 3 when --check finds a breaking change", async () => {
    writeFileSync(join(absoluteDir, "Button.svelte"), "<script></script>\n<button>Click</button>\n");
    writeFileSync(join(absoluteDir, "index.js"), 'export { default as Button } from "./Button.svelte";\n');
    const snapshotFile = join(relativeDir, "COMPONENT_API.json");
    const snapshot = buildComponentApiDocument(
      new Map([["Button", mockComponentDocApi("Button", "Button.svelte", { props: [] })]]),
    );
    writeFileSync(join(absoluteDir, "COMPONENT_API.json"), JSON.stringify(snapshot));
    writeFileSync(
      join(absoluteDir, "Button.svelte"),
      "<script>\n  export let label;\n</script>\n<button>{label}</button>\n",
    );

    const result = await sveld({ entry, types: false, check: snapshotFile });

    expect(result.exitCode).toBe(3);
  });

  test("result.exitCode is 3 (not 4) when a breaking check and strict diagnostics both apply", async () => {
    writeFileSync(
      join(absoluteDir, "Phantom.svelte"),
      "<script>\n  /** @event {CustomEvent<null>} phantom */\n  export let label;\n</script>\n<button>{label}</button>\n",
    );
    writeFileSync(join(absoluteDir, "index.js"), 'export { default as Phantom } from "./Phantom.svelte";\n');
    const snapshotFile = join(relativeDir, "COMPONENT_API.json");
    const snapshot = buildComponentApiDocument(
      new Map([["Phantom", mockComponentDocApi("Phantom", "Phantom.svelte", { props: [] })]]),
    );
    writeFileSync(join(absoluteDir, "COMPONENT_API.json"), JSON.stringify(snapshot));

    const result = await sveld({ entry, types: false, check: snapshotFile, strict: true });

    expect(result.check?.bump).toBe("major");
    expect(result.exitCode).toBe(3);
  });

  test("result.errors is populated for a component that fails to parse", async () => {
    writeFileSync(
      join(absoluteDir, "Broken.svelte"),
      "<script>\n  export let label = ;\n</script>\n<button>{label}</button>\n",
    );
    writeFileSync(join(absoluteDir, "index.js"), 'export { default as Broken } from "./Broken.svelte";\n');

    const result = await sveld({ entry, types: false });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual(expect.objectContaining({ filePath: expect.stringContaining("Broken.svelte") }));
  });
});
