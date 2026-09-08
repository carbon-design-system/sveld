import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { asNormalizedPath } from "../src/brands";
import { generateBundle } from "../src/bundle";
import ComponentParser from "../src/ComponentParser";
import { collectExampleSources } from "../src/example-check";
import { TypeResolver } from "../src/resolve-types";

const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "example-check");
const COMPONENT_PATH = path.join(FIXTURE_DIR, "input.svelte");
const ARGUMENT_REGEX = /argument/i;

/** A valid and a broken `svelte`-fenced `@example`, and nothing checkable by `tsc`. */
const MARKUP_ONLY_COMPONENT = `<script>
  /**
   * @example
   * \`\`\`svelte
   * <Widget prop="ok" />
   * \`\`\`
   */
  export let validExample = "a";

  /**
   * Mismatched closing tag: not valid Svelte markup.
   * @example
   * \`\`\`svelte
   * <div></span>
   * \`\`\`
   */
  export let brokenExample = "b";
</script>
`;

/** A broken \`svelte\`-fenced example alongside a plain TS/JS one, on the same component. */
const MIXED_EXAMPLE_COMPONENT = `<script>
  /**
   * Mismatched closing tag: not valid Svelte markup.
   * @example
   * \`\`\`svelte
   * <div></span>
   * \`\`\`
   */
  export let brokenExample = "b";

  /**
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

async function parseFixture() {
  const source = await Bun.file(COMPONENT_PATH).text();
  const parser = new ComponentParser();
  return parser.parseSvelteComponent(source, {
    moduleName: "ExampleCheck",
    filePath: asNormalizedPath(COMPONENT_PATH),
  });
}

describe("collectExampleSources", () => {
  test("tags plain TS/JS examples as 'compile' and svelte-fenced examples as 'syntax'", async () => {
    const parsed = await parseFixture();
    const sources = collectExampleSources(parsed);
    const byId = Object.fromEntries(sources.map((source) => [source.id, source]));

    expect(Object.keys(byId).sort()).toEqual([
      "prop:formatValue",
      "prop:newFormatName",
      "prop:tooManyArgs",
      "prop:widgetSlot",
    ]);
    expect(byId["prop:formatValue"]).toMatchObject({
      name: "formatValue",
      type: "(value: any) => any",
      kind: "compile",
    });
    expect(byId["prop:formatValue"].code).toBe('formatValue("ok");');
    expect(byId["prop:widgetSlot"]).toMatchObject({ kind: "syntax" });
    expect(byId["prop:widgetSlot"].code).toBe("<Widget prop={doesNotExist} />");
  });
});

describe("opt-in @example compile checking", () => {
  test("flags a renamed symbol and a wrong-arity call, leaves a valid example untouched", async () => {
    const parsed = await parseFixture();
    // Only `kind: "compile"` sources reach the TypeScript program; bundle.ts
    // filters the same way before calling `checkExamples`.
    const sources = collectExampleSources(parsed).filter((source) => source.kind === "compile");

    const created = await TypeResolver.create(FIXTURE_DIR);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const resolver = created.resolver;

    try {
      const diagnosticsByFilePath = await resolver.checkExamples([
        { moduleName: "ExampleCheck", filePath: COMPONENT_PATH, sources },
      ]);

      const diagnostics = diagnosticsByFilePath.get(COMPONENT_PATH) ?? [];
      const byId = Object.fromEntries(diagnostics.map((d) => [d.id, d]));

      expect(byId["prop:formatValue"]).toBeUndefined();

      expect(byId["prop:newFormatName"]?.message).toContain("oldFormatName");
      expect(byId["prop:tooManyArgs"]?.message).toMatch(ARGUMENT_REGEX);
    } finally {
      await resolver.dispose();
    }
  }, 30_000);
});

describe("checkExamples: syntax-checking svelte/html fences", () => {
  let dir: string;
  let createSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "sveld-example-syntax-"));
    createSpy = jest.spyOn(TypeResolver, "create");
  });

  afterEach(() => {
    createSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  test("a broken svelte fence produces an example-syntax-error diagnostic; a valid one does not", async () => {
    writeFileSync(path.join(dir, "index.js"), `export { default as Widget } from "./Widget.svelte";\n`);
    writeFileSync(path.join(dir, "Widget.svelte"), MARKUP_ONLY_COMPONENT);

    const result = await generateBundle(path.join(dir, "index.js"), true, { checkExamples: true });
    const syntaxDiagnostics = result.diagnostics.filter((d) => d.kind === "example-syntax-error");
    const byName = Object.fromEntries(syntaxDiagnostics.map((d) => [d.name, d]));

    expect(byName.validExample).toBeUndefined();
    expect(byName.brokenExample?.message).toContain("invalid closing tag");
  });

  test("checkExamples: true with only markup fences never loads TypeScript (no tsconfig.json needed)", async () => {
    writeFileSync(path.join(dir, "index.js"), `export { default as Widget } from "./Widget.svelte";\n`);
    writeFileSync(path.join(dir, "Widget.svelte"), MARKUP_ONLY_COMPONENT);

    await generateBundle(path.join(dir, "index.js"), true, { checkExamples: true });

    expect(createSpy).not.toHaveBeenCalled();
  });

  test("checkExamples: 'syntax' skips the TS/JS example on a mixed component and never loads TypeScript", async () => {
    writeFileSync(path.join(dir, "index.js"), `export { default as Widget } from "./Widget.svelte";\n`);
    writeFileSync(path.join(dir, "Widget.svelte"), MIXED_EXAMPLE_COMPONENT);

    const result = await generateBundle(path.join(dir, "index.js"), true, { checkExamples: "syntax" });
    const syntaxDiagnostics = result.diagnostics.filter((d) => d.kind === "example-syntax-error");

    expect(syntaxDiagnostics.map((d) => d.name)).toEqual(["brokenExample"]);
    expect(result.diagnostics.some((d) => d.kind === "example-compile-error")).toBe(false);
    expect(createSpy).not.toHaveBeenCalled();
  });
});
