import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ComponentDocApi, ComponentDocs } from "../src/bundle";
import pluginSveld, { createSerialQueue } from "../src/plugin";
import { createSveldBundle } from "../src/watch";

/** Look up `allComponentsForTypes` by filePath; moduleName is not unique. */
function byModuleName(components: ComponentDocs, moduleName: string): ComponentDocApi | undefined {
  return Array.from(components.values()).find((component) => component.moduleName === moduleName);
}

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
    const names = Array.from(bundle.result.allComponentsForTypes.values(), (c) => c.moduleName).sort();
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

  test("picks up a newly created component file", async () => {
    const bundle = await createSveldBundle(dir, true);

    const newPath = resolve(dir, "NewOne.svelte");
    writeFileSync(newPath, `<script>\n  export let label = "new";\n</script>\n\n<span>{label}</span>`);

    const { result, reparsed } = await bundle.update([newPath]);

    expect(reparsed).toContain(newPath);
    expect(byModuleName(result.allComponentsForTypes, "NewOne")).toBeDefined();
  });

  test("picks up a newly created component that shares a basename with an existing one", async () => {
    const bundle = await createSveldBundle(dir, true);

    // Same shape as the collision #402 fixed for the one-shot `generateBundle`
    // path, but exercised through the incremental `mergeGlobbedComponents`
    // call in `update()`, which has its own dedupe/collision-warning state.
    mkdirSync(join(dir, "nested"));
    const newPath = resolve(dir, "nested", "Button.svelte");
    writeFileSync(newPath, `<script>\n  export let size = "small";\n</script>\n\n<button>{size}</button>`);

    const { result, reparsed } = await bundle.update([newPath]);

    expect(reparsed).toContain(newPath);

    const buttons = Array.from(result.allComponentsForTypes.values()).filter((c) => c.moduleName === "Button");
    expect(buttons).toHaveLength(2);

    const original = buttons.find((c) => !c.filePath.includes("nested"));
    const added = buttons.find((c) => c.filePath.includes("nested"));
    expect(original?.props.map((p) => p.name)).toEqual(["primary"]);
    expect(added?.props.map((p) => p.name)).toEqual(["size"]);
  });

  test("picks up a deleted component file", async () => {
    const bundle = await createSveldBundle(dir, true);

    const standalonePath = resolve(dir, "Standalone.svelte");
    unlinkSync(standalonePath);

    const { result } = await bundle.update([standalonePath]);

    expect(byModuleName(result.allComponentsForTypes, "Standalone")).toBeUndefined();
  });

  test("deleting an @extendProps dependency reparses its dependent without crashing", async () => {
    const bundle = await createSveldBundle(dir, true);

    const buttonPath = resolve(dir, "Button.svelte");
    unlinkSync(buttonPath);

    const { result, reparsed } = await bundle.update([buttonPath]);

    expect(reparsed).toContain(resolve(dir, "SecondaryButton.svelte"));
    expect(byModuleName(result.allComponentsForTypes, "Button")).toBeUndefined();
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
    const button = byModuleName(result.allComponentsForTypes, "Button");
    const propNames = button?.props.map((p) => p.name) ?? [];
    expect(propNames).toContain("danger");
    expect(propNames).not.toContain("primary");
  });

  test("editing a non-.svelte @extendProps target reparses its dependent", async () => {
    const typesPath = join(dir, "types.ts");
    writeFileSync(typesPath, "export interface ExternalProps {\n  size: string;\n}\n");
    writeFileSync(
      join(dir, "WithExternalProps.svelte"),
      `<script>
  /** @extendProps {"./types.ts"} ExternalProps */
  export let size = "medium";
</script>

<div>{size}</div>`,
    );

    const bundle = await createSveldBundle(dir, true);

    writeFileSync(typesPath, "export interface ExternalProps {\n  size: string;\n  color: string;\n}\n");
    const { reparsed } = await bundle.update([resolve(typesPath)]);

    expect(reparsed).toEqual([resolve(dir, "WithExternalProps.svelte")]);
  });

  test("editing the entry barrel to add an export re-parses the newly exported component", async () => {
    const entryPath = join(dir, "index.js");
    writeFileSync(entryPath, 'export { default as Button } from "./Button.svelte";\n');

    const bundle = await createSveldBundle(entryPath, false);
    expect(Array.from(bundle.result.components.keys())).toEqual(["Button"]);

    writeFileSync(
      entryPath,
      'export { default as Button } from "./Button.svelte";\n' +
        'export { default as Standalone } from "./Standalone.svelte";\n',
    );

    const { result, reparsed } = await bundle.update([resolve(entryPath)]);

    expect(Array.from(result.components.keys()).sort()).toEqual(["Button", "Standalone"]);
    expect(reparsed).toContain(resolve(dir, "Standalone.svelte"));
  });

  test("editing the entry barrel to remove an export drops it from the exported components", async () => {
    const entryPath = join(dir, "index.js");
    writeFileSync(
      entryPath,
      'export { default as Button } from "./Button.svelte";\n' +
        'export { default as Standalone } from "./Standalone.svelte";\n',
    );

    const bundle = await createSveldBundle(entryPath, false);
    expect(Array.from(bundle.result.components.keys()).sort()).toEqual(["Button", "Standalone"]);

    writeFileSync(entryPath, 'export { default as Button } from "./Button.svelte";\n');

    const { result } = await bundle.update([resolve(entryPath)]);

    expect(Array.from(result.components.keys())).toEqual(["Button"]);
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

describe("createSerialQueue", () => {
  test("queues a call that arrives while the previous one is still in flight, instead of overlapping it", async () => {
    const order: string[] = [];
    let concurrent = 0;
    let maxConcurrent = 0;

    const run = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      order.push("start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("end");
      concurrent--;
    };

    const trigger = createSerialQueue(run);
    trigger();
    trigger(); // Fires while the first `run()` is still awaiting its timeout.

    // Wait for both queued runs to settle.
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(maxConcurrent).toBe(1);
    expect(order).toEqual(["start", "end", "start", "end"]);
  });

  test("a rejected run does not break the queue for the next call", async () => {
    const order: string[] = [];
    const run = jest
      .fn<() => Promise<void>>()
      .mockImplementationOnce(async () => {
        order.push("first");
        throw new Error("boom");
      })
      .mockImplementationOnce(async () => {
        order.push("second");
      });

    const trigger = createSerialQueue(run);
    trigger();
    trigger();

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(order).toEqual(["first", "second"]);
  });
});
