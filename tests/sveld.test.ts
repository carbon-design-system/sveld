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
