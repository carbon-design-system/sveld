import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pluginSveld from "../src/plugin";
import { createSveldBundle } from "../src/watch";

const BUTTON = `<script>
  /** @restProps {button} */
  export let primary = false;
</script>

<button {...$$restProps}><slot /></button>`;

// Wraps Button via @extendProps, so it depends on Button.svelte.
const SECONDARY_BUTTON = `<script>
  /** @extendProps {"./Button.svelte"} ButtonProps */
  export let secondary = true;

  import Button from "./Button.svelte";
</script>

<Button {...$$restProps}><slot /></Button>`;

// Independent component with no relationship to Button.
const STANDALONE = `<script>
  export let label = "standalone";
</script>

<span>{label}</span>`;

describe("watch mode (createSveldBundle)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sveld-watch-"));
    writeFileSync(join(dir, "Button.svelte"), BUTTON);
    writeFileSync(join(dir, "SecondaryButton.svelte"), SECONDARY_BUTTON);
    writeFileSync(join(dir, "Standalone.svelte"), STANDALONE);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("initial bundle parses every component", async () => {
    const bundle = await createSveldBundle(dir, true);
    const names = Array.from(bundle.result.allComponentsForTypes.keys()).sort();
    expect(names).toEqual(["Button", "SecondaryButton", "Standalone"]);
  });

  test("editing a component re-parses it plus its @extendProps dependents only", async () => {
    const bundle = await createSveldBundle(dir, true);

    const buttonPath = resolve(dir, "Button.svelte");
    writeFileSync(buttonPath, BUTTON.replace("primary = false", "primary = true"));

    const { reparsed } = await bundle.update([buttonPath]);

    // Button changed; SecondaryButton depends on it via @extendProps.
    // Standalone is unrelated and must NOT be re-parsed.
    expect(reparsed.sort()).toEqual([resolve(dir, "Button.svelte"), resolve(dir, "SecondaryButton.svelte")].sort());
    expect(reparsed).not.toContain(resolve(dir, "Standalone.svelte"));
    expect(reparsed.length).toBeLessThan(bundle.result.allComponentsForTypes.size);
  });

  test("editing an independent component re-parses only that component", async () => {
    const bundle = await createSveldBundle(dir, true);

    const standalonePath = resolve(dir, "Standalone.svelte");
    writeFileSync(standalonePath, STANDALONE.replace('"standalone"', '"changed"'));

    const { reparsed } = await bundle.update([standalonePath]);

    expect(reparsed).toEqual([standalonePath]);
  });

  test("ignores non-svelte changes", async () => {
    const bundle = await createSveldBundle(dir, true);
    const { reparsed } = await bundle.update([resolve(dir, "README.md")]);
    expect(reparsed).toEqual([]);
  });

  test("re-parsed output reflects the edited source", async () => {
    const bundle = await createSveldBundle(dir, true);

    const buttonPath = resolve(dir, "Button.svelte");
    writeFileSync(buttonPath, BUTTON.replace("export let primary = false;", "export let danger = false;"));

    const { result } = await bundle.update([buttonPath]);
    const button = result.allComponentsForTypes.get("Button");
    const propNames = button?.props.map((p) => p.name) ?? [];
    expect(propNames).toContain("danger");
    expect(propNames).not.toContain("primary");
  });
});

describe("pluginSveld watch option", () => {
  test("defaults to build-only apply when watch is not set", () => {
    expect(pluginSveld().apply).toBe("build");
    expect(pluginSveld({ watch: false }).apply).toBe("build");
  });

  test("runs in serve and build (apply unset) when watch is enabled", () => {
    expect(pluginSveld({ watch: true }).apply).toBeUndefined();
  });

  test("hot updates are a no-op before the bundle is initialized", () => {
    const plugin = pluginSveld({ watch: true });
    // Should not throw when no bundle exists yet (e.g. invalid entry).
    expect(() => plugin.handleHotUpdate?.({ file: "/tmp/Anything.svelte" })).not.toThrow();
  });
});
