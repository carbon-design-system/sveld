import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type ComponentDocApi, type ComponentDocs, generateBundle } from "../src/bundle";
import ComponentParser from "../src/ComponentParser";
import { TypeResolver } from "../src/resolve-types";

const RESOLVER_FAILURE_MESSAGE_REGEX = /checkExamples.*tsconfig\.json/s;

/** Look up `allComponentsForTypes` by filePath; moduleName is not unique. */
function byModuleName(components: ComponentDocs, moduleName: string): ComponentDocApi | undefined {
  return Array.from(components.values()).find((component) => component.moduleName === moduleName);
}

const BUTTON = `<script>
  export let label = "button";
</script>

<button>{label}</button>`;

/** A plain-TS `@example` block; a checkExamples candidate. */
const EXAMPLE_CHECK_COMPONENT = `<script>
  /**
   * @param {string} value
   * @returns {string}
   * @example
   * \`\`\`js
   * formatValue("ok");
   * \`\`\`
   */
  export function formatValue(value) {
    return value;
  }
</script>
`;

/** No `@example` block: no candidates. */
const PLAIN_COMPONENT = `<script>
  /** @type {string} */
  export let label = "ok";
</script>
<button>{label}</button>
`;

function makeFakeResolver() {
  return {
    checkExamples: jest.fn(async () => new Map()),
    dispose: jest.fn(async () => {}),
  };
}

describe("generateBundle in-run parse dedupe", () => {
  let dir: string;
  let parseSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-bundle-dedupe-"));
    writeFileSync(path.join(dir, "Button.svelte"), BUTTON);
    writeFileSync(path.join(dir, "entry.js"), 'export { default as Button } from "./Button.svelte";\n');
    parseSpy = jest.spyOn(ComponentParser.prototype, "parse");
  });

  afterEach(() => {
    parseSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a component that is both exported and glob-discovered is parsed exactly once per run", async () => {
    const result = await generateBundle(path.join(dir, "entry.js"), true);

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(result.components.has("Button")).toBe(true);
    expect(byModuleName(result.allComponentsForTypes, "Button")).toBeDefined();
  });

  test("dedupes the same way when the on-disk cache is enabled", async () => {
    const cacheFile = path.join(dir, ".cache", "parse-cache.json");
    const result = await generateBundle(path.join(dir, "entry.js"), true, {
      cache: cacheFile,
    });

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(result.components.has("Button")).toBe(true);
    expect(byModuleName(result.allComponentsForTypes, "Button")).toBeDefined();
  });
});

describe("generateBundle creates a TypeResolver only for checkExamples compile candidates", () => {
  let dir: string;
  let createSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-bundle-"));
  });

  afterEach(() => {
    createSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  test("creates and disposes exactly one resolver when there are candidates", async () => {
    writeFileSync(path.join(dir, "ExampleCheck.svelte"), EXAMPLE_CHECK_COMPONENT);

    const fakeResolver = makeFakeResolver();
    createSpy = jest
      .spyOn(TypeResolver, "create")
      .mockResolvedValue({ ok: true, resolver: fakeResolver as unknown as TypeResolver });

    await generateBundle(dir, true, { checkExamples: true });

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(fakeResolver.checkExamples).toHaveBeenCalledTimes(1);
    expect(fakeResolver.dispose).toHaveBeenCalledTimes(1);
  });

  test("never creates a resolver when there are no candidates", async () => {
    writeFileSync(path.join(dir, "Plain.svelte"), PLAIN_COMPONENT);

    const fakeResolver = makeFakeResolver();
    createSpy = jest
      .spyOn(TypeResolver, "create")
      .mockResolvedValue({ ok: true, resolver: fakeResolver as unknown as TypeResolver });

    await generateBundle(dir, true, { checkExamples: true });

    expect(createSpy).not.toHaveBeenCalled();
  });

  test("a failed resolver (no tsconfig) fails the run instead of silently skipping the check", async () => {
    writeFileSync(path.join(dir, "ExampleCheck.svelte"), EXAMPLE_CHECK_COMPONENT);

    createSpy = jest.spyOn(TypeResolver, "create").mockResolvedValue({
      ok: false,
      reason: "no-tsconfig",
      message: 'could not locate a tsconfig.json starting from "/fake"',
    });

    await expect(generateBundle(dir, true, { checkExamples: true })).rejects.toThrow(RESOLVER_FAILURE_MESSAGE_REGEX);

    expect(createSpy).toHaveBeenCalledTimes(1);
  });
});

describe("generateBundle with a directory entry (no barrel) and --glob", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-bundle-dir-glob-"));
    writeFileSync(path.join(dir, "Button.svelte"), BUTTON);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("populates exports for JSON/Markdown, not just per-component .d.ts", async () => {
    const result = await generateBundle(dir, true);

    expect(Object.keys(result.exports)).toContain("Button");
    expect(result.exports.Button?.default).toBe(true);
    expect(result.components.has("Button")).toBe(true);
    expect(byModuleName(result.allComponentsForTypes, "Button")).toBeDefined();
  });
});

describe("generateBundle validates @extends/@extendProps targets", () => {
  let dir: string;

  const BASE = `<script>
  /** @type {string} */
  export let variant = "a";
</script>
`;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-bundle-extends-"));
    writeFileSync(path.join(dir, "Base.svelte"), BASE);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("flags an @extendProps target that isn't found on disk", async () => {
    writeFileSync(
      path.join(dir, "Missing.svelte"),
      `<script>\n  /** @extendProps {"./NoSuchFile.svelte"} BaseProps */\n</script>\n`,
    );

    const result = await generateBundle(dir, true);
    const component = byModuleName(result.allComponentsForTypes, "Missing");

    expect(component?.diagnostics).toContainEqual(
      expect.objectContaining({ kind: "extend-props-target-missing", name: "BaseProps" }),
    );
  });

  test("flags an @extendProps interface name that doesn't match the target's generated Props name", async () => {
    writeFileSync(
      path.join(dir, "Mismatch.svelte"),
      `<script>\n  /** @extendProps {"./Base.svelte"} WrongProps */\n</script>\n`,
    );

    const result = await generateBundle(dir, true);
    const component = byModuleName(result.allComponentsForTypes, "Mismatch");

    expect(component?.diagnostics).toContainEqual(
      expect.objectContaining({ kind: "extend-props-target-missing", name: "WrongProps" }),
    );
  });

  test("flags an own prop that collides with a same-named prop of a different type on the target", async () => {
    writeFileSync(
      path.join(dir, "Collide.svelte"),
      `<script>
  /** @extendProps {"./Base.svelte"} BaseProps */

  /** @type {number} */
  export let variant = 1;
</script>
`,
    );

    const result = await generateBundle(dir, true);
    const component = byModuleName(result.allComponentsForTypes, "Collide");

    expect(component?.diagnostics).toContainEqual(
      expect.objectContaining({ kind: "extend-props-override", name: "variant" }),
    );
  });

  test("does not flag a matching target with no colliding prop names", async () => {
    writeFileSync(
      path.join(dir, "Clean.svelte"),
      `<script>
  /** @extendProps {"./Base.svelte"} BaseProps */

  /** @type {string} */
  export let label = "ok";
</script>
`,
    );

    const result = await generateBundle(dir, true);
    const component = byModuleName(result.allComponentsForTypes, "Clean");

    expect(component?.diagnostics?.some((d) => d.kind.startsWith("extend-props-"))).toBeFalsy();
  });

  test("finds a target the way an import resolves it", async () => {
    writeFileSync(path.join(dir, "types.ts"), "export interface TypesProps {}\n");
    mkdirSync(path.join(dir, "shared"));
    writeFileSync(path.join(dir, "shared", "index.ts"), "export interface SharedProps {}\n");
    writeFileSync(path.join(dir, "legacy.mjs"), "export {};\n");
    for (const [name, specifier, iface] of [
      ["JsSpecifier", "./types.js", "TypesProps"],
      ["DirectoryIndex", "./shared", "SharedProps"],
      ["ModuleJs", "./legacy", "LegacyProps"],
    ]) {
      writeFileSync(
        path.join(dir, `${name}.svelte`),
        `<script>\n  /** @extendProps {"${specifier}"} ${iface} */\n</script>\n`,
      );
    }

    const result = await generateBundle(dir, true);

    for (const name of ["JsSpecifier", "DirectoryIndex", "ModuleJs"]) {
      const component = byModuleName(result.allComponentsForTypes, name);
      expect((component?.diagnostics ?? []).filter((d) => d.kind.startsWith("extend-props-"))).toEqual([]);
    }
  });

  test("checks an extensionless target against the component it names", async () => {
    writeFileSync(
      path.join(dir, "NoExtension.svelte"),
      `<script>\n  /** @extendProps {"./Base"} WrongProps */\n</script>\n`,
    );

    const result = await generateBundle(dir, true);
    const component = byModuleName(result.allComponentsForTypes, "NoExtension");

    expect(component?.diagnostics).toContainEqual(
      expect.objectContaining({ kind: "extend-props-target-missing", name: "WrongProps" }),
    );
  });

  test("does not attempt to verify a bare/package import specifier", async () => {
    writeFileSync(
      path.join(dir, "External.svelte"),
      `<script>\n  /** @extendProps {"svelte/elements"} HTMLAttributes */\n</script>\n`,
    );

    const result = await generateBundle(dir, true);
    const component = byModuleName(result.allComponentsForTypes, "External");

    expect(component?.diagnostics?.some((d) => d.kind.startsWith("extend-props-"))).toBeFalsy();
  });
});

describe("generateBundle flags module-script re-exports named like a generated type", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-bundle-reexport-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("flags a re-export named like the generated Props type", async () => {
    writeFileSync(
      path.join(dir, "Tree.svelte"),
      `<script context="module">\n  export { TreeProps, toHierarchy } from "./types.js";\n</script>\n`,
    );

    const result = await generateBundle(dir, true);
    const diagnostics = byModuleName(result.allComponentsForTypes, "Tree")?.diagnostics ?? [];

    expect(diagnostics).toContainEqual(expect.objectContaining({ kind: "module-export-conflict", name: "TreeProps" }));
    expect(diagnostics.filter((d) => d.kind === "module-export-conflict")).toHaveLength(1);
  });
});
