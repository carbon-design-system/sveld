import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { type ComponentDocApi, type ComponentDocs, type GenerateBundleResult, generateBundle } from "../src/bundle";
import ComponentParser from "../src/ComponentParser";
import pluginSveld, { createSerialQueue, writeOutput } from "../src/plugin";
import { createSveldBundle } from "../src/watch";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions-core";

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

  test("editing a component re-parses only it, not its @extendProps dependents", async () => {
    const bundle = await createSveldBundle(dir, true);

    const buttonPath = resolve(dir, "Button.svelte");
    writeFileSync(buttonPath, BUTTON.replace("primary = false", "primary = true"));

    const { reparsed } = await bundle.update([buttonPath]);

    // SecondaryButton's parse doesn't read Button, so it's kept.
    expect(reparsed).toEqual([buttonPath]);
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

  test("deleting an @extendProps target flags its dependent without re-parsing it", async () => {
    const bundle = await createSveldBundle(dir, true);

    const buttonPath = resolve(dir, "Button.svelte");
    unlinkSync(buttonPath);

    const { result, reparsed } = await bundle.update([buttonPath]);

    expect(reparsed).toEqual([]);
    expect(byModuleName(result.allComponentsForTypes, "Button")).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ component: "./SecondaryButton.svelte", kind: "extend-props-target-missing" }),
    );
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

  test("writing an updated result rewrites the .d.ts and JSON output", async () => {
    const bundle = await createSveldBundle(dir, true);
    const outDir = join(dir, "types");
    const outFile = join(dir, "COMPONENT_API.json");
    const opts = { types: true, json: true, typesOptions: { outDir }, jsonOptions: { outFile }, quiet: true };
    const input = join(dir, "index.js");
    await writeOutput(await bundle.result, opts, input);

    const buttonPath = resolve(dir, "Button.svelte");
    writeFileSync(buttonPath, BUTTON.replace("export let primary = false;", "export let danger = false;"));
    const { result } = await bundle.update([buttonPath]);
    await writeOutput(result, opts, input);

    const dts = readFileSync(join(outDir, "Button.svelte.d.ts"), "utf8");
    expect(dts).toContain("danger?: boolean");
    expect(dts).not.toContain("primary?: boolean");
    const api = JSON.parse(readFileSync(outFile, "utf8"));
    const button = api.components.find((c: { moduleName: string }) => c.moduleName === "Button");
    expect(button.props.map((p: { name: string }) => p.name)).toEqual(["danger"]);
  });

  test("editing a non-.svelte @extendProps target re-parses nothing", async () => {
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

    expect(reparsed).toEqual([]);
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

  test("reports an ambiguous `export *` in the barrel until an edit resolves it", async () => {
    const entryPath = join(dir, "index.js");
    writeFileSync(join(dir, "a.js"), "export const format = 1;\n");
    writeFileSync(join(dir, "b.js"), "export const format = 2;\n");
    writeFileSync(entryPath, 'export * from "./a.js";\nexport * from "./b.js";\n');

    const bundle = await createSveldBundle(entryPath, false, { documentExports: true });
    const initial = await bundle.result;
    expect(initial.entryExports).toEqual([]);
    expect(initial.diagnostics).toContainEqual(
      expect.objectContaining({ component: "./index.js", kind: "export-ambiguous", name: "format" }),
    );

    writeFileSync(entryPath, 'export * from "./a.js";\nexport * from "./b.js";\nexport { format } from "./a.js";\n');
    const { result } = await bundle.update([resolve(entryPath)]);

    expect(result.entryExports.map((entry) => entry.name)).toEqual(["format"]);
    expect(result.diagnostics.some((d) => d.kind === "export-ambiguous")).toBe(false);
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

  test("reports @extendProps and module re-export problems like a one-shot build", async () => {
    const entryPath = join(dir, "index.js");
    writeFileSync(
      join(dir, "Card.svelte"),
      `<script context="module">
  export { CardProps } from "./card-props.js";
</script>
<script>
  /** @extendProps {"./Missing.svelte"} MissingProps */
  export let title = "";
</script>
`,
    );
    writeFileSync(entryPath, 'export { default as Card } from "./Card.svelte";\n');

    const bundle = await createSveldBundle(entryPath, false);
    const kinds = (diagnostics: Array<{ kind: string }>) => diagnostics.map((diagnostic) => diagnostic.kind).sort();
    expect(kinds((await bundle.result).diagnostics)).toEqual(["extend-props-target-missing", "module-export-conflict"]);

    // Re-parsing reports them once, not once more per update.
    const { result } = await bundle.update([resolve(dir, "Card.svelte")]);
    expect(kinds(result.diagnostics)).toEqual(["extend-props-target-missing", "module-export-conflict"]);
    expect(kinds(result.components.get("Card")?.diagnostics ?? [])).toEqual([
      "extend-props-target-missing",
      "module-export-conflict",
    ]);
  });

  test("an update after an @extendProps target changes matches a fresh build", async () => {
    const outputOf = (result: GenerateBundleResult) =>
      JSON.stringify({
        components: Array.from(result.allComponentsForTypes, ([key, component]) => [
          key,
          component,
          writeTsDefinition(component),
        ]),
        diagnostics: result.diagnostics,
      });
    const fresh = async () => outputOf(await generateBundle(dir, true, { cache: false }));
    const typesPath = join(dir, "types.ts");
    writeFileSync(typesPath, "export interface ExternalProps {\n  size: string;\n}\n");
    writeFileSync(
      join(dir, "WithExternalProps.svelte"),
      `<script>\n  /** @extendProps {"./types.ts"} ExternalProps */\n  export let size = "medium";\n</script>\n`,
    );
    const bundle = await createSveldBundle(dir, true, { cache: false });

    // Button's `primary` becomes a string, which SecondaryButton now overrides.
    writeFileSync(
      join(dir, "SecondaryButton.svelte"),
      SECONDARY_BUTTON.replace(
        "export let secondary = true;",
        "export let secondary = true;\n  export let primary = false;",
      ),
    );
    await bundle.update([join(dir, "SecondaryButton.svelte")]);
    const buttonPath = join(dir, "Button.svelte");
    writeFileSync(buttonPath, BUTTON.replace("primary = false", 'primary = "yes"'));
    const edited = await bundle.update([buttonPath]);
    expect(outputOf(edited.result)).toBe(await fresh());
    expect(edited.result.diagnostics).toContainEqual(
      expect.objectContaining({ component: "./SecondaryButton.svelte", kind: "extend-props-override" }),
    );

    unlinkSync(buttonPath);
    expect(outputOf((await bundle.update([buttonPath])).result)).toBe(await fresh());

    unlinkSync(typesPath);
    const removed = await bundle.update([typesPath]);
    expect(outputOf(removed.result)).toBe(await fresh());
    expect(removed.result.diagnostics).toContainEqual(
      expect.objectContaining({ component: "./WithExternalProps.svelte", kind: "extend-props-target-missing" }),
    );
  });

  test("an update returns a new result and leaves the previous one as it was", async () => {
    const bundle = await createSveldBundle(dir, true);
    const before = await bundle.result;
    const buttonBefore = byModuleName(before.allComponentsForTypes, "Button");

    const buttonPath = resolve(dir, "Button.svelte");
    writeFileSync(buttonPath, BUTTON.replace("export let primary = false;", "export let danger = false;"));
    const { result } = await bundle.update([buttonPath]);

    expect(result).not.toBe(before);
    expect(result.allComponentsForTypes).not.toBe(before.allComponentsForTypes);
    expect(byModuleName(before.allComponentsForTypes, "Button")).toBe(buttonBefore);
    expect(buttonBefore?.props.map((prop) => prop.name)).toEqual(["primary"]);
    expect(await bundle.result).toBe(result);
  });

  test("checks @example blocks with checkExamples, re-checking only re-parsed components", async () => {
    const example = (markup: string) => `<script>
  /**
   * @example
   * \`\`\`svelte
   * ${markup}
   * \`\`\`
   */
  export let value = 0;
</script>`;
    const examplePath = join(dir, "Example.svelte");
    writeFileSync(examplePath, example("<Example value={1}></div>"));

    const bundle = await createSveldBundle(dir, true, { checkExamples: "syntax" });
    const syntaxErrors = (result: Awaited<typeof bundle.result>) =>
      result.diagnostics.filter((diagnostic) => diagnostic.kind === "example-syntax-error").map((d) => d.name);
    expect(syntaxErrors(await bundle.result)).toEqual(["value"]);

    // An unrelated edit keeps the diagnostic without re-checking it.
    const standalonePath = resolve(dir, "Standalone.svelte");
    writeFileSync(standalonePath, STANDALONE.replace('"standalone"', '"changed"'));
    expect(syntaxErrors((await bundle.update([standalonePath])).result)).toEqual(["value"]);

    writeFileSync(examplePath, example("<Example value={1} />"));
    expect(syntaxErrors((await bundle.update([examplePath])).result)).toEqual([]);
  });

  test("marks diagnostics matched by diagnostics.ignore as ignored", async () => {
    writeFileSync(join(dir, "Untyped.svelte"), "<script>\n  export let value;\n</script>\n");
    const ignore = [{ code: "sveld/prop-unknown-type" as const, component: "**/Untyped.svelte" }];

    const bundle = await createSveldBundle(dir, true, { diagnostics: { ignore } });
    const unknownType = (result: Awaited<typeof bundle.result>) =>
      result.diagnostics.find((diagnostic) => diagnostic.kind === "prop-unknown-type");
    expect(unknownType(await bundle.result)).toMatchObject({ name: "value", ignored: true });

    const untypedPath = resolve(dir, "Untyped.svelte");
    writeFileSync(untypedPath, "<script>\n  export let other;\n</script>\n");
    expect(unknownType((await bundle.update([untypedPath])).result)).toMatchObject({ name: "other", ignored: true });
  });

  test("reuses the parse cache across dev-server restarts and keeps it current on update", async () => {
    const cache = join(dir, ".cache", "parse-cache.json");
    const parseSpy = jest.spyOn(ComponentParser.prototype, "parse");
    try {
      const first = await createSveldBundle(dir, true, { cache });
      expect(parseSpy).toHaveBeenCalledTimes(3);
      expect(existsSync(cache)).toBe(true);

      const standalonePath = resolve(dir, "Standalone.svelte");
      writeFileSync(standalonePath, STANDALONE.replace("export let label", "export let text"));
      await first.update([standalonePath]);
      expect(parseSpy).toHaveBeenCalledTimes(4);

      parseSpy.mockClear();
      const restarted = await createSveldBundle(dir, true, { cache });
      expect(parseSpy).not.toHaveBeenCalled();
      const standalone = byModuleName((await restarted.result).allComponentsForTypes, "Standalone");
      expect(standalone?.props.map((prop) => prop.name)).toEqual(["text"]);
    } finally {
      parseSpy.mockRestore();
    }
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

  test("a hot update regenerates the output, and one failed flush doesn't stop the next", async () => {
    const dir = mkdtempSync(join(process.cwd(), ".tmp-sveld-watch-hot-"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const buttonPath = join(dir, "Button.svelte");
      writeFileSync(buttonPath, BUTTON);
      writeFileSync(join(dir, "index.js"), 'export { default as Button } from "./Button.svelte";\n');
      const outDir = join(dir, "types");
      const dtsPath = join(outDir, "Button.svelte.d.ts");
      const plugin = pluginSveld({
        entry: relative(process.cwd(), join(dir, "index.js")),
        watch: true,
        quiet: true,
        typesOptions: { outDir },
      });

      await plugin.buildStart();
      expect(readFileSync(dtsPath, "utf8")).toContain("primary?: boolean");

      /** Waits out the debounce and the serial flush queue. */
      const waitFor = async (condition: () => boolean) => {
        for (let attempt = 0; attempt < 100 && !condition(); attempt++) {
          // biome-ignore lint/performance/noAwaitInLoops: polling; each check must see the previous wait.
          await Bun.sleep(20);
        }
        expect(condition()).toBe(true);
      };

      // A flush whose write fails (the output dir is now a file) is logged, not thrown.
      rmSync(outDir, { recursive: true, force: true });
      writeFileSync(outDir, "");
      writeFileSync(buttonPath, BUTTON.replace("export let primary = false;", "export let danger = false;"));
      plugin.handleHotUpdate?.({ file: buttonPath });
      await waitFor(() =>
        errorSpy.mock.calls.some((call) => call[0] === "sveld: failed to regenerate types in watch mode:"),
      );

      rmSync(outDir, { force: true });
      writeFileSync(buttonPath, BUTTON.replace("export let primary = false;", 'export let kind = "a";'));
      plugin.handleHotUpdate?.({ file: buttonPath });
      await waitFor(() => existsSync(dtsPath) && readFileSync(dtsPath, "utf8").includes("kind?: string"));
    } finally {
      errorSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a failed initial build does not crash buildStart; it logs and leaves the dev server running", async () => {
    // `getSvelteEntry` joins `entry` onto `process.cwd()` rather than treating an absolute path
    // as already-absolute, so the fixture lives under `process.cwd()` itself (as elsewhere in this
    // suite) rather than `os.tmpdir()`: on Windows CI, the checkout and the OS temp dir can sit on
    // different drives, and `path.relative` across drives falls back to an absolute path, which
    // `getSvelteEntry` then mangles into a bogus one.
    const dir = mkdtempSync(join(process.cwd(), ".tmp-sveld-watch-buildstart-"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      writeFileSync(join(dir, "Button.svelte"), BUTTON);
      // The output dir is a file, so the initial write fails.
      const outDir = join(dir, "types");
      writeFileSync(outDir, "");
      const plugin = pluginSveld({
        entry: relative(process.cwd(), join(dir, "Button.svelte")),
        watch: true,
        quiet: true,
        typesOptions: { outDir },
      });

      await expect(plugin.buildStart()).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        "sveld: failed to generate initial types in watch mode:",
        expect.anything(),
      );
    } finally {
      errorSpy.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("createSerialQueue", () => {
  test("queues a call that arrives while the previous one is still in flight, instead of overlapping it", async () => {
    const order: string[] = [];
    let concurrent = 0;
    let maxConcurrent = 0;
    let finished = 0;
    const { promise: bothSettled, resolve: settle } = Promise.withResolvers<void>();

    const run = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      order.push("start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("end");
      concurrent--;
      if (++finished === 2) settle();
    };

    const trigger = createSerialQueue(run);
    trigger();
    trigger(); // Fires while the first `run()` is still awaiting its timeout.

    // Wait for both queued runs to settle, however slow the machine's timers are.
    await bothSettled;

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
