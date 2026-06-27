import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertComponentApi,
  ComponentApiDriftError,
  generateComponentApi,
  writeComponentApiSnapshot,
} from "../src/testing";

const SNAPSHOT_NOT_FOUND_REGEX = /golden snapshot not found/;

const BUTTON = `<script>
  /** The button type. */
  export let type = "button";
  export let primary = false;
</script>

<!-- @component A clickable button. -->
<button {...$$restProps} {type} class:primary on:click>
  <slot>Click me</slot>
</button>
`;

interface Fixture {
  dir: string;
  entry: string;
  snapshot: string;
  /** Overwrite the Button component source. */
  setButton(source: string): void;
}

function createFixture(buttonSource = BUTTON): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), "sveld-testing-"));
  writeFileSync(path.join(dir, "index.js"), 'import Button from "./Button.svelte";\nexport { Button };\n');
  writeFileSync(path.join(dir, "Button.svelte"), buttonSource);
  return {
    dir,
    entry: path.join(dir, "index.js"),
    snapshot: path.join(dir, "__snapshots__", "component-api.json"),
    setButton(source: string) {
      writeFileSync(path.join(dir, "Button.svelte"), source);
    },
  };
}

describe("generateComponentApi", () => {
  let fixture: Fixture;
  afterEach(() => rmSync(fixture.dir, { recursive: true, force: true }));

  test("projects the parsed component into a deterministic snapshot", async () => {
    fixture = createFixture();
    const api = await generateComponentApi({ input: fixture.entry });

    expect(api.version).toBe(1);
    expect(Object.keys(api.components)).toEqual(["Button"]);

    const button = api.components.Button;
    expect(Object.keys(button.props)).toEqual(["primary", "type"]);
    expect(button.props.type).toMatchObject({ type: "string", description: "The button type." });
    expect(button.rest_props).toBe(true);
    expect(button.description).toContain("A clickable button.");
    // No volatile data (file paths, source ranges, generator version) leaks in.
    expect(JSON.stringify(api)).not.toContain("filePath");
    expect(JSON.stringify(api)).not.toContain('"source"');
  });

  test("is stable across repeated generation", async () => {
    fixture = createFixture();
    const first = await generateComponentApi({ input: fixture.entry });
    const second = await generateComponentApi({ input: fixture.entry });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe("assertComponentApi", () => {
  let fixture: Fixture;
  afterEach(() => rmSync(fixture.dir, { recursive: true, force: true }));

  test("throws a helpful error when the snapshot is missing", async () => {
    fixture = createFixture();
    await expect(assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot })).rejects.toThrow(
      SNAPSHOT_NOT_FOUND_REGEX,
    );
  });

  test("writes the snapshot in update mode, then passes on a matching run", async () => {
    fixture = createFixture();
    const written = await assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot, update: true });
    expect(written.matches).toBe(true);
    expect(existsSync(fixture.snapshot)).toBe(true);

    const matched = await assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot });
    expect(matched.matches).toBe(true);
  });

  test("honors the SVELD_UPDATE_SNAPSHOT environment variable", async () => {
    fixture = createFixture();
    process.env.SVELD_UPDATE_SNAPSHOT = "1";
    try {
      await assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot });
    } finally {
      delete process.env.SVELD_UPDATE_SNAPSHOT;
    }
    expect(existsSync(fixture.snapshot)).toBe(true);
  });

  test("fails with a breaking classification when a prop is removed", async () => {
    fixture = createFixture();
    await assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot, update: true });

    fixture.setButton(BUTTON.replace("  export let primary = false;\n", ""));

    const error = (await assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot }).catch(
      (e) => e,
    )) as ComponentApiDriftError;

    expect(error).toBeInstanceOf(ComponentApiDriftError);
    expect(error.diff.classification).toBe("breaking");
    expect(error.message).toContain("prop `primary` was removed");
  });

  test("fails with an additive classification when an optional prop is added", async () => {
    fixture = createFixture();
    await assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot, update: true });

    fixture.setButton(
      BUTTON.replace(
        "  export let primary = false;\n",
        "  export let primary = false;\n  export let disabled = false;\n",
      ),
    );

    const error = (await assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot }).catch(
      (e) => e,
    )) as ComponentApiDriftError;

    expect(error.diff.classification).toBe("additive");
    expect(error.message).toContain("prop `disabled` was added");
  });

  test("fails with a doc-only classification when only a description changes", async () => {
    fixture = createFixture();
    await assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot, update: true });

    fixture.setButton(BUTTON.replace("The button type.", "The kind of button."));

    const error = (await assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot }).catch(
      (e) => e,
    )) as ComponentApiDriftError;

    expect(error.diff.classification).toBe("doc-only");
    expect(error.diff.docOnly).toHaveLength(1);
  });

  test("passes after the snapshot is refreshed to match the new API", async () => {
    fixture = createFixture();
    await assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot, update: true });

    fixture.setButton(
      BUTTON.replace(
        "  export let primary = false;\n",
        "  export let primary = false;\n  export let disabled = false;\n",
      ),
    );
    await assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot, update: true });

    const matched = await assertComponentApi({ input: fixture.entry, snapshot: fixture.snapshot });
    expect(matched.matches).toBe(true);
  });
});

describe("writeComponentApiSnapshot", () => {
  let fixture: Fixture;
  afterEach(() => rmSync(fixture.dir, { recursive: true, force: true }));

  test("writes pretty-printed JSON with a trailing newline and nested dirs", async () => {
    fixture = createFixture();
    const api = await generateComponentApi({ input: fixture.entry });
    writeComponentApiSnapshot(fixture.snapshot, api);

    const contents = readFileSync(fixture.snapshot, "utf-8");
    expect(contents.endsWith("}\n")).toBe(true);
    expect(contents).toContain('\n  "version": 1');
    expect(JSON.parse(contents)).toEqual(api);
  });
});
