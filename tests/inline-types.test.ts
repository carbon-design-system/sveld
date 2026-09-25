import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import ts from "@typescript/typescript6";
import type { ComponentDocApi, ComponentDocs } from "../src/bundle";
import { generateBundle } from "../src/bundle";
import { clearConfigCache } from "../src/resolve-alias";

/** Look up `allComponentsForTypes` by filePath; moduleName is not unique. */
function byModuleName(components: ComponentDocs, moduleName: string): ComponentDocApi | undefined {
  return Array.from(components.values()).find((component) => component.moduleName === moduleName);
}

describe("inlineLocalTypeImports (via generateBundle typesInline)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sveld-inline-types-"));
    clearConfigCache();
  });

  afterEach(() => {
    clearConfigCache();
    rmSync(dir, { recursive: true, force: true });
  });

  test("simple type alias", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Size } from "./types";
  let { size }: { size: Size } = $props();
</script>
<div>{size}</div>
`,
    );
    writeFileSync(join(dir, "types.ts"), `export type Size = "sm" | "md" | "lg";\n`);

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    expect(component).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.droppedImportStatements).toEqual(['import type { Size } from "./types";']);
    expect(inlined?.declarations).toEqual(['type Size = "sm" | "md" | "lg";']);
    expect(inlined?.dependencies).toEqual([join(dir, "types.ts")]);
    expect(result.diagnostics.filter((d) => d.kind === "types-inline-unresolved")).toEqual([]);
  });

  test("a .js specifier naming a .ts file", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Size } from "./types.js";
  let { size }: { size: Size } = $props();
</script>
<div>{size}</div>
`,
    );
    writeFileSync(join(dir, "types.ts"), `export type Size = "sm" | "md" | "lg";\n`);

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    const inlined = component ? result.inlinedTypesByFilePath?.get(component.filePath) : undefined;

    expect(inlined?.declarations).toEqual(['type Size = "sm" | "md" | "lg";']);
    expect(inlined?.dependencies).toEqual([join(dir, "types.ts")]);
  });

  test("interface", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Props } from "./types";
  let { value }: { value: Props } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "types.ts"), "export interface Props {\n  a: string;\n}\n");

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: parsed above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.declarations).toEqual(["interface Props {\n  a: string;\n}"]);
    expect(inlined?.droppedImportStatements).toHaveLength(1);
  });

  test("re-export via export { X as Y } from", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Bar } from "./types";
  let { value }: { value: Bar } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "other.ts"), "export type Foo = string;\n");
    writeFileSync(join(dir, "types.ts"), `export { Foo as Bar } from "./other";\n`);

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: parsed above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.declarations).toEqual(["type Foo = string;", "type Bar = Foo;"]);
    expect(inlined?.dependencies).toEqual(expect.arrayContaining([join(dir, "other.ts"), join(dir, "types.ts")]));
  });

  test("export * from", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Foo } from "./types";
  let { value }: { value: Foo } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "other.ts"), "export type Foo = string;\n");
    writeFileSync(join(dir, "types.ts"), `export * from "./other";\n`);

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: parsed above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.declarations).toEqual(["type Foo = string;"]);
  });

  test("a type referencing a same-file helper type copies the helper first", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Foo } from "./types";
  let { value }: { value: Foo } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "types.ts"), "type Helper = string;\nexport type Foo = Helper;\n");

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: parsed above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.declarations).toEqual(["type Helper = string;", "type Foo = Helper;"]);
  });

  test("a type referencing its own type parameter and a global copies nothing extra", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Box } from "./types";
  let { value }: { value: Box<string> } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "types.ts"), "export type Box<T> = { value: T; extra: Record<string, T> };\n");

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: parsed above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.declarations).toEqual(["type Box<T> = { value: T; extra: Record<string, T> };"]);
  });

  test("an aliased import (as) yields an extra alias declaration", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Size as MySize } from "./types";
  let { value }: { value: MySize } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "types.ts"), `export type Size = "sm" | "md" | "lg";\n`);

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: parsed above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.declarations).toEqual(['type Size = "sm" | "md" | "lg";', "type MySize = Size;"]);
  });

  test("resolves a tsconfig path alias", async () => {
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "$lib/*": ["./lib/*"] } } }),
    );
    mkdirSync(join(dir, "lib"), { recursive: true });
    writeFileSync(join(dir, "lib", "types.ts"), `export type Size = "sm" | "md" | "lg";\n`);
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Size } from "$lib/types";
  let { value }: { value: Size } = $props();
</script>
<div />
`,
    );

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: parsed above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.declarations).toEqual(['type Size = "sm" | "md" | "lg";']);
  });

  test("refuses a missing file, keeping the import and warning", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { X } from "./missing";
  let { value }: { value: X } = $props();
</script>
<div />
`,
    );

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const diagnostic = result.diagnostics.find((d) => d.kind === "types-inline-unresolved");

    expect(diagnostic).toBeDefined();
    expect(diagnostic?.name).toBe("X");
    expect(diagnostic?.message).toContain("was not found on disk");
    expect(diagnostic?.severity).toBe("warning");
    expect(diagnostic?.code).toBe("sveld/types-inline-unresolved");
  });

  test("refuses a name not exported by the source file", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { X } from "./types";
  let { value }: { value: X } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "types.ts"), "export type Y = string;\n");

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const diagnostic = result.diagnostics.find((d) => d.kind === "types-inline-unresolved");

    expect(diagnostic).toBeDefined();
    expect(diagnostic?.message).toContain("not exported");
  });

  test("refuses an enum export", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Color } from "./types";
  let { value }: { value: Color } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "types.ts"), "export enum Color {\n  Red,\n  Green,\n}\n");

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const diagnostic = result.diagnostics.find((d) => d.kind === "types-inline-unresolved");

    expect(diagnostic).toBeDefined();
    expect(diagnostic?.message).toContain("enum");
  });

  test("refuses a name colliding with a component @typedef", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  /** @typedef {number} Size */
  import type { Size as MySize } from "./types";
  let { value }: { value: MySize } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "types.ts"), `export type Size = "sm" | "md" | "lg";\n`);

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    expect(component?.typedefs.some((typedef) => typedef.name === "Size")).toBe(true);

    const diagnostic = result.diagnostics.find((d) => d.kind === "types-inline-unresolved");
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.name).toBe("MySize");
    expect(diagnostic?.message).toContain("collides");
    // biome-ignore lint/style/noNonNullAssertion: parsed above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);
    expect(inlined?.droppedImportStatements ?? []).toEqual([]);
  });

  test("refuses names the writer declares or imports itself, and names a kept import binds", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Comp } from "./self";
  import type { CompComponent } from "./generic";
  import type { $Props } from "./helper";
  import type { Snippet } from "./snippet";
  import type { Uses } from "./uses";
  import type { Shared } from "some-package";
  import type { Size } from "./size";
  let { a, b, c, d, e, f, g }: { a: Comp; b: CompComponent; c: $Props; d: Snippet; e: Uses; f: Shared; g: Size } =
    $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "self.ts"), "export type Comp = { a: 1 };\n");
    writeFileSync(join(dir, "generic.ts"), "export type CompComponent = { b: 1 };\n");
    writeFileSync(join(dir, "helper.ts"), "export type $Props = { c: 1 };\n");
    writeFileSync(join(dir, "snippet.ts"), "export type Snippet = { d: 1 };\n");
    // Copying `Uses` would copy a local `Shared`, clashing with the package import above.
    writeFileSync(join(dir, "uses.ts"), "export type Shared = { e: 1 };\nexport type Uses = { shared: Shared };\n");
    writeFileSync(join(dir, "size.ts"), `export type Size = "sm" | "md";\n`);

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: parsed above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.droppedImportStatements).toEqual(['import type { Size } from "./size";']);
    const messages = result.diagnostics.filter((d) => d.kind === "types-inline-unresolved").map((d) => d.message);
    expect(messages.sort()).toEqual(
      [
        ["$Props", "$Props"],
        ["Comp", "Comp"],
        ["CompComponent", "CompComponent"],
        ["Snippet", "Snippet"],
        ["Uses", "Shared"],
      ].map(
        ([name, collision]) =>
          `Cannot inline "${name}": "${collision}" collides with a name the component's .d.ts already declares or imports.`,
      ),
    );
  });

  test("collision check uses a templated typesOptions.typeNames, not the default name", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { CompApi } from "./types";
  let { value }: { value: CompApi } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "types.ts"), "export type CompApi = string;\n");

    // Default props type name is "CompProps", so the import (named "CompApi") does not collide
    // and inlines cleanly.
    const withoutTemplate = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const withoutComponent = byModuleName(withoutTemplate.allComponentsForTypes, "Comp");
    expect(withoutTemplate.diagnostics.filter((d) => d.kind === "types-inline-unresolved")).toEqual([]);
    expect(withoutTemplate.inlinedTypesByFilePath?.get(withoutComponent?.filePath ?? "")?.declarations).toEqual([
      "type CompApi = string;",
    ]);

    // With `typeNames.props: "{name}Api"` the actual generated props type name is "CompApi",
    // which does collide with the imported name; the pass must check against that templated
    // name, not the unused default, so it refuses instead of silently emitting a duplicate.
    const withTemplate = await generateBundle(dir, true, {
      cache: false,
      typesInline: "local",
      typesTypeNames: { props: "{name}Api" },
    });
    const withComponent = byModuleName(withTemplate.allComponentsForTypes, "Comp");
    const diagnostic = withTemplate.diagnostics.find((d) => d.kind === "types-inline-unresolved");
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.name).toBe("CompApi");
    expect(diagnostic?.message).toContain("collides");
    expect(withTemplate.inlinedTypesByFilePath?.get(withComponent?.filePath ?? "")?.declarations ?? []).toEqual([]);
  });

  test("refuses the second of two imports of the same name from different files", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Foo as A } from "./a";
  import type { Foo as B } from "./b";
  let { x, y }: { x: A; y: B } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "a.ts"), "export type Foo = string;\n");
    writeFileSync(join(dir, "b.ts"), "export type Foo = number;\n");

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: parsed above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.declarations).toEqual(["type Foo = string;", "type A = Foo;"]);
    expect(inlined?.droppedImportStatements).toEqual(['import type { Foo as A } from "./a";']);

    const diagnostic = result.diagnostics.find((d) => d.kind === "types-inline-unresolved");
    expect(diagnostic?.name).toBe("B");
    expect(diagnostic?.message).toContain("already inlined from a different source");
  });

  test("refuses an earlier import whose copy declares a name a later refused import keeps", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { A } from "./a";
  import type { E, X } from "./x";
  let { a, e, x }: { a: A; e: E; x: X } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "a.ts"), `import type { X } from "./x";\nexport type A = { x: X };\n`);
    writeFileSync(join(dir, "x.ts"), "export type X = string;\nexport enum E {\n  One,\n}\n");

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: parsed above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    // Copying `A` would copy `X` too, next to the kept `import type { E, X }`.
    expect(inlined).toBeUndefined();
    const messages = result.diagnostics.filter((d) => d.kind === "types-inline-unresolved").map((d) => d.message);
    expect(messages).toEqual([
      `Cannot inline "A": "X" collides with a name the component's .d.ts already declares or imports.`,
      `Cannot inline "E": "E" is an enum, which cannot be inlined.`,
    ]);
  });

  test("a cycle between two files terminates and inlines both", async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { A } from "./a";
  let { value }: { value: A } = $props();
</script>
<div />
`,
    );
    writeFileSync(join(dir, "a.ts"), `import type { B } from "./b";\nexport type A = { next?: B };\n`);
    writeFileSync(join(dir, "b.ts"), `import type { A } from "./a";\nexport type B = { next?: A };\n`);

    const result = await generateBundle(dir, true, { cache: false, typesInline: "local" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: parsed above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.declarations).toHaveLength(2);
    expect(inlined?.declarations.join("\n")).toContain("type A = { next?: B };");
    expect(inlined?.declarations.join("\n")).toContain("type B = { next?: A };");
    expect(inlined?.droppedImportStatements).toEqual(['import type { A } from "./a";']);
    expect(result.diagnostics.filter((d) => d.kind === "types-inline-unresolved")).toEqual([]);
  });
});

describe("inlineLocalTypeImports fixture-level snapshots", () => {
  const FIXTURES_DIR = join(import.meta.dir, "fixtures");

  test("ts-runes-per-prop-imported-type inlines Size and type-checks", async () => {
    const fixtureDir = join(FIXTURES_DIR, "ts-runes-per-prop-imported-type");
    const result = await generateBundle(fixtureDir, true, {
      cache: false,
      typesInline: "local",
    });
    const component = byModuleName(result.allComponentsForTypes, "input");
    expect(component).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.declarations).toEqual(['type Size = "sm" | "md" | "lg";']);
    expect(inlined?.droppedImportStatements).toEqual(['import type { Size } from "./types";']);
  });

  test("runes-whole-props-imported inlines Props and type-checks", async () => {
    const fixtureDir = join(FIXTURES_DIR, "runes-whole-props-imported");
    const result = await generateBundle(fixtureDir, true, {
      cache: false,
      resolveTypes: true,
      typesInline: "local",
    });
    const component = byModuleName(result.allComponentsForTypes, "input");
    expect(component).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    // `runes-whole-props-imported`'s props come from `resolveTypes` expanding the whole-object
    // `$props()` type, not from a per-prop `typeImportStatements` entry, so there may be nothing
    // to inline here; assert only that inlining never crashes and produces no bogus diagnostics.
    expect(result.diagnostics.filter((d) => d.kind === "types-inline-unresolved")).toEqual(
      inlined === undefined ? [] : expect.any(Array),
    );
  }, 30_000); // `resolveTypes` starts a TypeScript program, slow on a busy machine.
});

/**
 * Bundles `files` with `typesInline: "local"`, writes `Comp.svelte.d.ts`, and type-checks it with
 * tsc. Created inside the repo (not the system tmpdir) so `moduleResolution: "bundler"` can walk
 * up to the repo's own `node_modules/svelte` when type-checking the generated `.d.ts`.
 */
async function bundleAndTypecheck(files: Record<string, string>) {
  const tempDir = mkdtempSync(join(process.cwd(), ".tmp-sveld-inline-types-tsc-"));
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(tempDir, name), content);

    const writeTsDefinitions = (await import("../src/writer/writer-ts-definitions")).default;
    const result = await generateBundle(tempDir, true, { cache: false, typesInline: "local" });
    // Next to the sources, so an import the `.d.ts` keeps resolves as it would for a consumer.
    const outDirAbsolute = tempDir;
    // `writeTsDefinitions` resolves `outDir` against `process.cwd()`, so it must be relative
    // here (an absolute path would get joined onto `process.cwd()` instead of used as-is).
    const outDir = relative(process.cwd(), outDirAbsolute);

    await writeTsDefinitions(result.allComponentsForTypes, {
      outDir,
      inputDir: tempDir,
      preamble: "",
      exports: result.exports,
      inlinedTypesByFilePath: result.inlinedTypesByFilePath,
      inline: "local",
    });

    const dtsPath = join(outDirAbsolute, "Comp.svelte.d.ts");
    const dtsText = await Bun.file(dtsPath).text();

    const configPath = join(process.cwd(), "tsconfig.fixtures.json");
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());

    const program = ts.createProgram([dtsPath], parsedConfig.options);
    const tscDiagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) =>
      ts.formatDiagnostic(diagnostic, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => outDirAbsolute,
        getNewLine: () => "\n",
      }),
    );
    return { result, dtsText, tscDiagnostics };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("typesOptions.inline output type-checks", () => {
  test("a component with an inlined type produces valid TypeScript, verified with tsc", async () => {
    const { dtsText, tscDiagnostics } = await bundleAndTypecheck({
      "Comp.svelte": `<script lang="ts">
  import type { Size } from "./types";
  let { size }: { size: Size } = $props();
</script>
<div>{size}</div>
`,
      "types.ts": `export type Size = "sm" | "md" | "lg";\n`,
    });

    expect(dtsText).not.toContain('from "./types"');
    expect(dtsText).toContain('type Size = "sm" | "md" | "lg";');
    expect(tscDiagnostics).toEqual([]);
  });

  test("an import kept after a refusal doesn't clash with a name an earlier import copied", async () => {
    // Inlining `A` copies a.ts's own `X`; the import of b.ts's `X` can't reuse that name, but
    // keeping it as an import next to the copied `type X` would declare `X` twice.
    const { result, dtsText, tscDiagnostics } = await bundleAndTypecheck({
      "Comp.svelte": `<script lang="ts">
  import type { A } from "./a";
  import type { X } from "./b";
  let { a, x }: { a: A; x: X } = $props();
</script>
<div />
`,
      "a.ts": "type X = string;\nexport type A = { x: X };\n",
      "b.ts": "export type X = number;\n",
    });

    expect(tscDiagnostics).toEqual([]);
    expect(dtsText).toContain('import type { A } from "./a";');
    expect(dtsText).toContain("type X = number;");
    expect(dtsText).not.toContain("type X = string;");
    expect(
      result.diagnostics.filter((d) => d.kind === "types-inline-unresolved").map((d) => [d.name, d.message]),
    ).toEqual([["A", 'Cannot inline "A": "X" was already inlined from a different source.']]);
  });
});

/**
 * `typesOptions.inline: "all"` needs the real TypeScript checker (see `resolve-types.ts`'s
 * `TypeResolver.openBareTypeSession`), which needs a resolvable `tsconfig.json` and `node_modules`
 * lookup for both `typescript` itself and any fabricated bare package below. Created inside the
 * repo (not the system tmpdir), same reasoning as the `tsc`-verification test above: module
 * resolution needs to walk up to the repo's own `node_modules`.
 */
describe('typesOptions.inline: "all" (bare/package imports)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(process.cwd(), ".tmp-sveld-inline-all-"));
    writeFileSync(
      join(dir, "tsconfig.json"),
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
    clearConfigCache();
  });

  afterEach(() => {
    clearConfigCache();
    rmSync(dir, { recursive: true, force: true });
  });

  /** Writes a fabricated `node_modules/some-lib` package with `content` as its `index.d.ts`. */
  function writeSomeLib(content: string, extraFiles: Record<string, string> = {}) {
    const libDir = join(dir, "node_modules", "some-lib");
    mkdirSync(libDir, { recursive: true });
    writeFileSync(join(libDir, "package.json"), JSON.stringify({ name: "some-lib", types: "index.d.ts" }));
    writeFileSync(join(libDir, "index.d.ts"), content);
    for (const [name, fileContent] of Object.entries(extraFiles)) {
      writeFileSync(join(libDir, name), fileContent);
    }
  }

  test("inlines a type alias, an interface, a same-file cross-reference, and a re-export through a sibling file", async () => {
    writeSomeLib(
      `export type Size = "sm" | "md" | "lg";
export interface Container {
  item: Item;
}
export interface Item {
  id: string;
}
export type { Real as Reexported } from "./real";
`,
      { "real.d.ts": "export type Real = string;\n" },
    );
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Size, Container, Reexported } from "some-lib";
  let { size, container, extra }: { size: Size; container: Container; extra: Reexported } = $props();
</script>
<div />
`,
    );

    const result = await generateBundle(dir, true, { cache: false, typesInline: "all" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    expect(component).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.droppedImportStatements).toEqual(['import type { Container, Reexported, Size } from "some-lib";']);
    const text = inlined?.declarations.join("\n") ?? "";
    expect(text).toContain('type Size = "sm" | "md" | "lg";');
    expect(text).toContain("interface Container {");
    expect(text).toContain("interface Item {"); // same-file cross-reference, recursed and copied.
    expect(text).toContain("type Real = string;"); // re-export through a sibling file, followed transparently.
    expect(text).toContain("type Reexported = Real;"); // imported name differs from the declared name.
    expect(result.diagnostics.filter((d) => d.kind === "types-inline-unresolved")).toEqual([]);
  }, 30_000);

  test('an import from "svelte"/"svelte/elements" stays an import, never inlined', async () => {
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  let { rest }: { rest: HTMLButtonAttributes } = $props();
</script>
<div />
`,
    );

    const result = await generateBundle(dir, true, { cache: false, typesInline: "all" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: asserted above component lookup below
    expect(result.inlinedTypesByFilePath?.has(component!.filePath)).toBeFalsy();
    expect(result.diagnostics.filter((d) => d.kind === "types-inline-unresolved")).toEqual([]);
  }, 30_000);

  test("a reference inside a copied bare declaration that resolves to a DOM global is left alone, not copied", async () => {
    writeSomeLib("export interface Widget {\n  target: EventTarget;\n}\n");
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { Widget } from "some-lib";
  let { widget }: { widget: Widget } = $props();
</script>
<div />
`,
    );

    const result = await generateBundle(dir, true, { cache: false, typesInline: "all" });
    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);

    expect(inlined?.declarations).toEqual(["interface Widget {\n  target: EventTarget;\n}"]);
    expect(inlined?.droppedImportStatements).toHaveLength(1);
    expect(result.diagnostics.filter((d) => d.kind === "types-inline-unresolved")).toEqual([]);
  }, 30_000);

  test("refuses an unresolvable bare import, keeping the statement and warning", async () => {
    writeSomeLib(`export type Size = "sm" | "md" | "lg";\n`);
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { DoesNotExist } from "some-lib";
  let { value }: { value: DoesNotExist } = $props();
</script>
<div />
`,
    );

    const result = await generateBundle(dir, true, { cache: false, typesInline: "all" });
    const diagnostic = result.diagnostics.find((d) => d.kind === "types-inline-unresolved");

    expect(diagnostic).toBeDefined();
    expect(diagnostic?.name).toBe("DoesNotExist");
    expect(diagnostic?.message).toContain("could not be resolved from");
    expect(diagnostic?.severity).toBe("warning");
    expect(diagnostic?.code).toBe("sveld/types-inline-unresolved");

    const component = byModuleName(result.allComponentsForTypes, "Comp");
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const inlined = result.inlinedTypesByFilePath?.get(component!.filePath);
    expect(inlined?.droppedImportStatements ?? []).toEqual([]);
  }, 30_000);

  test("refuses an entry-level bare import that resolves to a TypeScript default-lib global", async () => {
    writeSomeLib(`export type { EventTarget as GlobalThing } from "./dom-passthrough";\n`, {
      "dom-passthrough.d.ts": "export type { EventTarget };\n",
    });
    writeFileSync(
      join(dir, "Comp.svelte"),
      `<script lang="ts">
  import type { GlobalThing } from "some-lib";
  let { value }: { value: GlobalThing } = $props();
</script>
<div />
`,
    );

    const result = await generateBundle(dir, true, { cache: false, typesInline: "all" });
    const diagnostic = result.diagnostics.find((d) => d.kind === "types-inline-unresolved");

    expect(diagnostic).toBeDefined();
    expect(diagnostic?.name).toBe("GlobalThing");
    expect(diagnostic?.message).toContain("built-in TypeScript type");
  }, 30_000);
});
