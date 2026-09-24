import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import type { ComponentDocApi, ComponentDocs } from "../src/bundle";
import pluginSveld, { createSerialQueue } from "../src/plugin";
import { TypeResolver } from "../src/resolve-types";
import { createSveldBundle } from "../src/watch";

const INLINE_ALL_RESOLVER_FAILURE_MESSAGE_REGEX = /typesOptions\.inline: "all".*tsconfig\.json/s;

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
    const initial = await bundle.result;
    const names = Array.from(initial.allComponentsForTypes.values(), (c) => c.moduleName).sort();
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
    expect(reparsed.length).toBeLessThan((await bundle.result).allComponentsForTypes.size);
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
    expect(Array.from((await bundle.result).components.keys())).toEqual(["Button"]);

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
    expect(Array.from((await bundle.result).components.keys()).sort()).toEqual(["Button", "Standalone"]);

    writeFileSync(entryPath, 'export { default as Button } from "./Button.svelte";\n');

    const { result } = await bundle.update([resolve(entryPath)]);

    expect(Array.from(result.components.keys())).toEqual(["Button"]);
    // No `.d.ts` for it either, same as a fresh build without --glob.
    expect(Array.from(result.allComponentsForTypes.values(), (c) => c.moduleName)).toEqual(["Button"]);
  });

  test("removing a barrel export stops reporting its parse error", async () => {
    const entryPath = join(dir, "index.js");
    writeFileSync(join(dir, "Broken.svelte"), "<script>export let = ;</script>\n");
    writeFileSync(
      entryPath,
      'export { default as Button } from "./Button.svelte";\n' +
        'export { default as Broken } from "./Broken.svelte";\n',
    );

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const bundle = await createSveldBundle(entryPath, false);
      expect((await bundle.result).errors.map((error) => error.moduleName)).toEqual(["Broken"]);

      writeFileSync(entryPath, 'export { default as Button } from "./Button.svelte";\n');
      const { result } = await bundle.update([resolve(entryPath)]);

      expect(result.errors).toEqual([]);
    } finally {
      errorSpy.mockRestore();
    }
  });

  test.each([false, true])("repointing a barrel export at another file re-parses it (glob: %p)", async (glob) => {
    const entryPath = join(dir, "index.js");
    writeFileSync(entryPath, 'export { default as Button } from "./Button.svelte";\n');

    const bundle = await createSveldBundle(entryPath, glob);
    expect((await bundle.result).components.get("Button")?.props.map((prop) => prop.name)).toEqual(["primary"]);

    writeFileSync(entryPath, 'export { default as Button } from "./Standalone.svelte";\n');
    const { result, reparsed } = await bundle.update([resolve(entryPath)]);

    expect(result.components.get("Button")?.filePath).toBe("./Standalone.svelte");
    expect(result.components.get("Button")?.props.map((prop) => prop.name)).toEqual(["label"]);
    expect(reparsed).toContain(resolve(dir, "Standalone.svelte"));
  });

  describe("values read from other modules", () => {
    const TIP = `<script>
  import { setContext, createEventDispatcher } from "svelte";
  import { DELAY, KEY } from "./constants.js";
  import { wire } from "./helper.js";
  export let delay = DELAY;
  setContext(KEY, { delay });
  const dispatch = createEventDispatcher();
  wire(dispatch);
</script>`;

    const summarize = (components: ComponentDocs) => {
      const tip = byModuleName(components, "Tip");
      const delay = tip?.props.find((prop) => prop.name === "delay");
      return {
        delay: [delay?.value, delay?.type],
        contexts: tip?.contexts?.map((context) => context.key),
        events: tip?.events.map((event) => event.name),
      };
    };

    beforeEach(() => {
      writeFileSync(join(dir, "Tip.svelte"), TIP);
      writeFileSync(join(dir, "constants.js"), 'export const DELAY = 100;\nexport const KEY = "one";\n');
      writeFileSync(join(dir, "helper.js"), 'export function wire(dispatch) { dispatch("alpha"); }\n');
      writeFileSync(join(dir, "index.js"), 'export { default as Tip } from "./Tip.svelte";\n');
    });

    test("resolves imported defaults, context keys, and helper events like a one-shot build", async () => {
      const bundle = await createSveldBundle(join(dir, "index.js"), false);
      const initial = await bundle.result;

      const expected = { delay: ["100", "number"], contexts: ["one"], events: ["alpha"] };
      expect(summarize(initial.components)).toEqual(expected);
      expect(summarize(initial.allComponentsForTypes)).toEqual(expected);
    });

    test("editing a module a component read from re-parses that component", async () => {
      const bundle = await createSveldBundle(join(dir, "index.js"), false);
      await bundle.result;

      writeFileSync(join(dir, "constants.js"), 'export const DELAY = "slow";\nexport const KEY = "two";\n');
      writeFileSync(join(dir, "helper.js"), 'export function wire(dispatch) { dispatch("beta"); }\n');
      const { result, reparsed } = await bundle.update([join(dir, "constants.js"), join(dir, "helper.js")]);

      expect(reparsed).toEqual([resolve(dir, "Tip.svelte")]);
      const expected = { delay: ['"slow"', "string"], contexts: ["two"], events: ["beta"] };
      expect(summarize(result.components)).toEqual(expected);
      expect(summarize(result.allComponentsForTypes)).toEqual(expected);
    });

    test("stops re-parsing a component once it no longer reads the module", async () => {
      const bundle = await createSveldBundle(join(dir, "index.js"), false);
      await bundle.result;

      writeFileSync(join(dir, "Tip.svelte"), STANDALONE);
      await bundle.update([join(dir, "Tip.svelte")]);

      const { reparsed } = await bundle.update([join(dir, "constants.js")]);
      expect(reparsed).toEqual([]);
    });
  });
});

describe("watch mode with typesOptions.inline", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sveld-watch-inline-"));
    writeFileSync(
      join(dir, "A.svelte"),
      `<script lang="ts">
  import type { Size } from "./a-types";
  let { size }: { size: Size } = $props();
</script>
<div>{size}</div>
`,
    );
    writeFileSync(join(dir, "a-types.ts"), `export type Size = "sm" | "md";\n`);
    writeFileSync(
      join(dir, "B.svelte"),
      `<script lang="ts">
  export let label = "b";
</script>
<span>{label}</span>
`,
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("editing a component's inline dependency refreshes only that component's inlined types", async () => {
    const bundle = await createSveldBundle(dir, true, false, "local");

    const initial = await bundle.result;
    const componentA = byModuleName(initial.allComponentsForTypes, "A");
    expect(componentA).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const before = initial.inlinedTypesByFilePath?.get(componentA!.filePath);
    expect(before?.declarations).toEqual(['type Size = "sm" | "md";']);

    // Not itself a component, so it's never in `update()`'s `reparsed` set - only the
    // inline-dependency reverse map lets this be picked up.
    writeFileSync(join(dir, "a-types.ts"), `export type Size = "sm" | "md" | "lg";\n`);
    const { result, reparsed } = await bundle.update([resolve(dir, "a-types.ts")]);

    expect(reparsed).toEqual([]);
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const after = result.inlinedTypesByFilePath?.get(componentA!.filePath);
    expect(after?.declarations).toEqual(['type Size = "sm" | "md" | "lg";']);
  });

  test("editing an unrelated component does not recompute another component's inlined types", async () => {
    const bundle = await createSveldBundle(dir, true, false, "local");

    const initial = await bundle.result;
    const componentA = byModuleName(initial.allComponentsForTypes, "A");
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const before = initial.inlinedTypesByFilePath?.get(componentA!.filePath);

    writeFileSync(
      join(dir, "B.svelte"),
      `<script lang="ts">
  export let label = "changed";
</script>
<span>{label}</span>
`,
    );
    const { result, reparsed } = await bundle.update([resolve(dir, "B.svelte")]);

    expect(reparsed).toEqual([resolve(dir, "B.svelte")]);
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const after = result.inlinedTypesByFilePath?.get(componentA!.filePath);
    // Same object reference: A's inline result was carried forward, not recomputed.
    expect(after).toBe(before);
  });
});

/**
 * `typesInline: "all"` needs the real TypeScript checker, so (unlike the rest of this file's
 * system-tmpdir components) these fixtures live inside the repo, same reasoning as the
 * `tsc`-verification test in `inline-types.test.ts`: module resolution needs to walk up to the
 * repo's own `node_modules` for both `typescript` and the fabricated bare package below.
 */
describe('watch mode with typesInline: "all"', () => {
  let allDir: string;
  let createSpy: ReturnType<typeof jest.spyOn> | undefined;

  beforeEach(() => {
    allDir = mkdtempSync(join(process.cwd(), ".tmp-sveld-watch-inline-all-"));
    writeFileSync(
      join(allDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true,
        },
        include: ["**/*"],
      }),
    );
    const libDir = join(allDir, "node_modules", "some-lib");
    mkdirSync(libDir, { recursive: true });
    writeFileSync(join(libDir, "package.json"), JSON.stringify({ name: "some-lib", types: "index.d.ts" }));
    writeFileSync(join(libDir, "index.d.ts"), `export type Size = "sm" | "md" | "lg";\n`);
  });

  afterEach(() => {
    createSpy?.mockRestore();
    createSpy = undefined;
    rmSync(allDir, { recursive: true, force: true });
  });

  test("inlines a bare package import and picks up an edit to it on the next result", async () => {
    const compPath = join(allDir, "Comp.svelte");
    writeFileSync(
      compPath,
      `<script lang="ts">
  import type { Size } from "some-lib";
  let { size }: { size: Size } = $props();
</script>
<div />
`,
    );

    const bundle = await createSveldBundle(allDir, true, false, "all");
    const initial = await bundle.result;
    const component = Array.from(initial.allComponentsForTypes.values()).find((c) => c.moduleName === "Comp");
    expect(component).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const inlined = initial.inlinedTypesByFilePath?.get(component!.filePath);
    expect(inlined?.declarations).toEqual(['type Size = "sm" | "md" | "lg";']);

    // Editing the bare package's own source (not the component) must be picked up on the next
    // `result`/`update()` access, same contract `"local"` already has for a relative source.
    writeFileSync(
      join(allDir, "node_modules", "some-lib", "index.d.ts"),
      `export type Size = "xs" | "sm" | "md" | "lg" | "xl";\n`,
    );

    const { result } = await bundle.update([compPath]);
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const reInlined = result.inlinedTypesByFilePath?.get(component!.filePath);
    expect(reInlined?.declarations).toEqual(['type Size = "xs" | "sm" | "md" | "lg" | "xl";']);
  }, 30_000);

  test("fails loudly at creation when the checker can't start, same contract as resolveTypes", async () => {
    createSpy = jest.spyOn(TypeResolver, "create").mockResolvedValue({
      ok: false,
      reason: "no-tsconfig",
      message: 'could not locate a tsconfig.json starting from "/fake"',
    });

    await expect(createSveldBundle(allDir, true, false, "all")).rejects.toThrow(
      INLINE_ALL_RESOLVER_FAILURE_MESSAGE_REGEX,
    );
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

  test("a bad config does not crash buildStart; it logs and leaves the dev server running", async () => {
    // `getSvelteEntry` joins `entry` onto `process.cwd()` rather than treating an absolute path
    // as already-absolute, so the fixture lives under `process.cwd()` itself (as elsewhere in this
    // suite) rather than `os.tmpdir()`: on Windows CI, the checkout and the OS temp dir can sit on
    // different drives, and `path.relative` across drives falls back to an absolute path, which
    // `getSvelteEntry` then mangles into a bogus one.
    const dir = mkdtempSync(join(process.cwd(), ".tmp-sveld-watch-buildstart-"));
    try {
      writeFileSync(
        join(dir, "Comp.svelte"),
        `<script lang="ts">
  import type { Size } from "./types";
  let { size }: { size: Size } = $props();
</script>
<div>{size}</div>
`,
      );
      writeFileSync(join(dir, "types.ts"), `export type Size = "sm" | "md";\n`);

      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      try {
        const plugin = pluginSveld({
          entry: relative(process.cwd(), join(dir, "Comp.svelte")),
          watch: true,
          typesOptions: { inline: "local", typeNames: { props: "NoPlaceholder" } },
        });

        await expect(plugin.buildStart()).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledWith(
          "sveld: failed to generate initial types in watch mode:",
          expect.any(Error),
        );
      } finally {
        errorSpy.mockRestore();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
