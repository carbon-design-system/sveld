import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { asNormalizedPath } from "../src/brands";
import ComponentParser, { applyResolvedProps, getParsedComponentTypeScriptMetadata } from "../src/ComponentParser";
import { bareOverlayVirtualFilePath } from "../src/inline-types";
import { TypeResolver } from "../src/resolve-types";

const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "runes-whole-props-imported");
const COMPONENT_PATH = path.join(FIXTURE_DIR, "input.svelte");

const UNION_FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "runes-whole-props-union-resolve-types");
const UNION_COMPONENT_PATH = path.join(UNION_FIXTURE_DIR, "input.svelte");

const GENERIC_FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "runes-whole-props-generic-resolve-types");
const GENERIC_COMPONENT_PATH = path.join(GENERIC_FIXTURE_DIR, "input.svelte");

async function parseFixture() {
  const source = await Bun.file(COMPONENT_PATH).text();
  const parser = new ComponentParser();
  return parser.parseSvelteComponent(source, {
    moduleName: "RunesWholePropsImported",
    filePath: asNormalizedPath(COMPONENT_PATH),
  });
}

async function parseUnionFixture() {
  const source = await Bun.file(UNION_COMPONENT_PATH).text();
  const parser = new ComponentParser();
  return parser.parseSvelteComponent(source, {
    moduleName: "RunesWholePropsUnionResolveTypes",
    filePath: asNormalizedPath(UNION_COMPONENT_PATH),
  });
}

async function parseGenericFixture() {
  const source = await Bun.file(GENERIC_COMPONENT_PATH).text();
  const parser = new ComponentParser();
  return parser.parseSvelteComponent(source, {
    moduleName: "RunesWholePropsGenericResolveTypes",
    filePath: asNormalizedPath(GENERIC_COMPONENT_PATH),
  });
}

describe("opt-in TypeScript semantic resolution", () => {
  test("default AST-only path leaves an imported whole-object props type opaque", async () => {
    const parsed = await parseFixture();

    expect(parsed.props).toEqual([]);
    expect(getParsedComponentTypeScriptMetadata(parsed)?.canonicalPropsType).toBe("Props");
  });

  test("resolveTypes expands the imported props type into structured props", async () => {
    const parsed = await parseFixture();
    const metadata = getParsedComponentTypeScriptMetadata(parsed);
    if (!metadata?.canonicalPropsType) throw new Error("fixture missing canonical props type");

    const created = await TypeResolver.create(FIXTURE_DIR);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const resolver = created.resolver;

    try {
      const resolved = await resolver.expandAll([
        {
          moduleName: "RunesWholePropsImported",
          metadata,
          filePath: COMPONENT_PATH,
        },
      ]);

      applyResolvedProps(parsed, resolved.get(COMPONENT_PATH) ?? []);
    } finally {
      await resolver.dispose();
    }

    const byName = Object.fromEntries(parsed.props.map((prop) => [prop.name, prop]));
    expect(Object.keys(byName).sort()).toEqual(["disabled", "href", "variant"]);

    expect(byName.disabled).toMatchObject({ type: "boolean", isRequired: false, typeSource: "typescript" });
    expect(byName.href).toMatchObject({ type: "string", isRequired: true, typeSource: "typescript" });
    expect(byName.variant).toMatchObject({
      type: '"primary" | "secondary"',
      isRequired: true,
      typeSource: "typescript",
    });
  }, 30_000);

  test("resolveTypes preserves variant-only properties from a discriminated union whole-props type", async () => {
    const parsed = await parseUnionFixture();
    const metadata = getParsedComponentTypeScriptMetadata(parsed);
    if (!metadata?.canonicalPropsType) throw new Error("fixture missing canonical props type");

    const created = await TypeResolver.create(UNION_FIXTURE_DIR);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const resolver = created.resolver;

    try {
      const resolved = await resolver.expandAll([
        {
          moduleName: "RunesWholePropsUnionResolveTypes",
          metadata,
          filePath: UNION_COMPONENT_PATH,
        },
      ]);

      applyResolvedProps(parsed, resolved.get(UNION_COMPONENT_PATH) ?? []);
    } finally {
      await resolver.dispose();
    }

    const byName = Object.fromEntries(parsed.props.map((prop) => [prop.name, prop]));
    expect(Object.keys(byName).sort()).toEqual(["duration", "kind", "target"]);

    expect(byName.kind).toMatchObject({ type: '"click" | "hover"', isRequired: true, typeSource: "typescript" });
    expect(byName.target).toMatchObject({ type: "string", isRequired: false, typeSource: "typescript" });
    expect(byName.duration).toMatchObject({ type: "number", isRequired: false, typeSource: "typescript" });
  }, 30_000);

  test("resolveTypes leaves a whole-props type parameterized by the component's own generic unexpanded", async () => {
    const parsed = await parseGenericFixture();
    const metadata = getParsedComponentTypeScriptMetadata(parsed);
    if (!metadata?.canonicalPropsType) throw new Error("fixture missing canonical props type");

    expect(metadata.canonicalPropsType).toBe("Props<T>");
    expect(metadata.referencesComponentGenerics).toBe(true);

    const created = await TypeResolver.create(GENERIC_FIXTURE_DIR);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const resolver = created.resolver;

    try {
      const resolved = await resolver.expandAll([
        {
          moduleName: "RunesWholePropsGenericResolveTypes",
          metadata,
          filePath: GENERIC_COMPONENT_PATH,
        },
      ]);

      // No entry: the resolver must not fabricate types for a generic it
      // can't bind, rather than guessing at (and getting wrong) unions.
      expect(resolved.has(GENERIC_COMPONENT_PATH)).toBe(false);

      applyResolvedProps(parsed, resolved.get(GENERIC_COMPONENT_PATH) ?? []);
    } finally {
      await resolver.dispose();
    }

    // Falls back to the same opaque, AST-derived shape the default path produces.
    expect(parsed.props).toEqual([]);
  }, 30_000);

  test("expandAll keys results by filePath so two targets sharing a moduleName resolve independently", async () => {
    const importedParsed = await parseFixture();
    const importedMetadata = getParsedComponentTypeScriptMetadata(importedParsed);
    if (!importedMetadata?.canonicalPropsType) throw new Error("fixture missing canonical props type");

    const unionParsed = await parseUnionFixture();
    const unionMetadata = getParsedComponentTypeScriptMetadata(unionParsed);
    if (!unionMetadata?.canonicalPropsType) throw new Error("fixture missing canonical props type");

    const created = await TypeResolver.create(FIXTURE_DIR);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const resolver = created.resolver;

    try {
      // Simulates two `--glob`-discovered `.svelte` files sharing a basename
      // in different directories (e.g. `Menu/Menu.svelte` and `icons/Menu.svelte`).
      const resolved = await resolver.expandAll([
        { moduleName: "Duplicate", metadata: importedMetadata, filePath: COMPONENT_PATH },
        { moduleName: "Duplicate", metadata: unionMetadata, filePath: UNION_COMPONENT_PATH },
      ]);

      applyResolvedProps(importedParsed, resolved.get(COMPONENT_PATH) ?? []);
      applyResolvedProps(unionParsed, resolved.get(UNION_COMPONENT_PATH) ?? []);
    } finally {
      await resolver.dispose();
    }

    expect(importedParsed.props.map((prop) => prop.name).sort()).toEqual(["disabled", "href", "variant"]);
    expect(unionParsed.props.map((prop) => prop.name).sort()).toEqual(["duration", "kind", "target"]);
  }, 30_000);
});

describe("TypeResolver.create failure modes", () => {
  test("reports not-installed when `typescript` cannot be found", async () => {
    const result = await TypeResolver.create(FIXTURE_DIR, {
      importTs: async () => ({ installed: false }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not-installed");
    expect(result.message).toContain("typescript");
    expect(result.message).toContain("TypeScript 7");
  });

  test("reports unsupported-version and names the installed version when below TypeScript 7", async () => {
    const result = await TypeResolver.create(FIXTURE_DIR, {
      importTs: async () => ({ installed: true, version: "5.9.0" }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unsupported-version");
    expect(result.message).toContain("5.9.0");
    expect(result.message).toContain("TypeScript 7");
  });

  test("reports no-tsconfig when TypeScript loads but no tsconfig.json is found", async () => {
    const noTsconfigDir = path.parse(process.cwd()).root;
    const result = await TypeResolver.create(noTsconfigDir, {
      importTs: async () => ({ installed: true, version: "7.0.2", module: {} }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no-tsconfig");
    expect(result.message).toContain("tsconfig.json");
  });
});

describe("TypeResolver.forgetOverlayFiles", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(process.cwd(), ".tmp-sveld-resolve-types-forget-overlay-"));
    writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", skipLibCheck: true },
        include: ["**/*"],
      }),
    );
    const libDir = path.join(dir, "node_modules", "some-lib");
    mkdirSync(libDir, { recursive: true });
    writeFileSync(path.join(libDir, "package.json"), JSON.stringify({ name: "some-lib", types: "index.d.ts" }));
    writeFileSync(path.join(libDir, "index.d.ts"), `export type Size = "sm" | "md" | "lg";\n`);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("removes an overlay file so a later session can no longer resolve positions in it", async () => {
    const created = await TypeResolver.create(dir);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const resolver = created.resolver;

    try {
      const virtualFile = bareOverlayVirtualFilePath(path.join(dir, "Comp.svelte"), "Comp");
      const content = 'import type { Size as __sveld_bare_0 } from "some-lib";\ntype __sveld_ref_0 = __sveld_bare_0;\n';
      const position = content.indexOf("__sveld_bare_0;");

      const firstSession = await resolver.openBareTypeSession(new Map([[virtualFile, content]]));
      try {
        const resolved = await firstSession.resolveAt(virtualFile, position);
        expect(resolved.kind).toBe("resolved");
      } finally {
        await firstSession.dispose();
      }

      // The component's bare import was removed; forget its stale overlay entry before the next
      // session, the way `watch.ts`'s `refreshInlinedTypes` does for every component it refreshes.
      resolver.forgetOverlayFiles([virtualFile]);

      const secondSession = await resolver.openBareTypeSession(new Map());
      try {
        const resolved = await secondSession.resolveAt(virtualFile, position);
        // The overlay file is gone, so there's no project for it anymore.
        expect(resolved.kind).toBe("unresolved");
      } finally {
        await secondSession.dispose();
      }
    } finally {
      await resolver.dispose();
    }
  }, 30_000);

  test("forgetting a file that's immediately given fresh content in the same call still resolves", async () => {
    // Mirrors `watch.ts`'s `refreshInlinedTypes`: it calls `forgetOverlayFiles` for every
    // component about to be refreshed, including ones that still have a bare import and so get a
    // fresh overlay entry moments later in the very same `openBareTypeSession` call - that's an
    // edit, not a removal, and must not be reported as `deleted` alongside its own `created` entry.
    const created = await TypeResolver.create(dir);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const resolver = created.resolver;

    try {
      const virtualFile = bareOverlayVirtualFilePath(path.join(dir, "Comp.svelte"), "Comp");
      const firstContent =
        'import type { Size as __sveld_bare_0 } from "some-lib";\ntype __sveld_ref_0 = __sveld_bare_0;\n';
      const firstPosition = firstContent.indexOf("__sveld_bare_0;");

      const firstSession = await resolver.openBareTypeSession(new Map([[virtualFile, firstContent]]));
      try {
        expect((await firstSession.resolveAt(virtualFile, firstPosition)).kind).toBe("resolved");
      } finally {
        await firstSession.dispose();
      }

      resolver.forgetOverlayFiles([virtualFile]);

      // Same virtual file, different content - as if the component's bare import changed rather
      // than being removed.
      const secondContent =
        'import type { Size as __sveld_bare_1 } from "some-lib";\ntype __sveld_ref_1 = __sveld_bare_1;\n';
      const secondPosition = secondContent.indexOf("__sveld_bare_1;");

      const secondSession = await resolver.openBareTypeSession(new Map([[virtualFile, secondContent]]));
      try {
        expect((await secondSession.resolveAt(virtualFile, secondPosition)).kind).toBe("resolved");
      } finally {
        await secondSession.dispose();
      }
    } finally {
      await resolver.dispose();
    }
  }, 30_000);
});
