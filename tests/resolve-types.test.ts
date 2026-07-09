import path from "node:path";
import { asNormalizedPath } from "../src/brands";
import ComponentParser, { applyResolvedProps, getParsedComponentTypeScriptMetadata } from "../src/ComponentParser";
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

    const resolver = await TypeResolver.create(FIXTURE_DIR);
    expect(resolver).not.toBeNull();
    if (!resolver) return;

    try {
      const resolved = await resolver.expandAll([
        {
          moduleName: "RunesWholePropsImported",
          metadata,
          filePath: COMPONENT_PATH,
        },
      ]);

      applyResolvedProps(parsed, resolved.get("RunesWholePropsImported") ?? []);
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

    const resolver = await TypeResolver.create(UNION_FIXTURE_DIR);
    expect(resolver).not.toBeNull();
    if (!resolver) return;

    try {
      const resolved = await resolver.expandAll([
        {
          moduleName: "RunesWholePropsUnionResolveTypes",
          metadata,
          filePath: UNION_COMPONENT_PATH,
        },
      ]);

      applyResolvedProps(parsed, resolved.get("RunesWholePropsUnionResolveTypes") ?? []);
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

    const resolver = await TypeResolver.create(GENERIC_FIXTURE_DIR);
    expect(resolver).not.toBeNull();
    if (!resolver) return;

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
      expect(resolved.has("RunesWholePropsGenericResolveTypes")).toBe(false);

      applyResolvedProps(parsed, resolved.get("RunesWholePropsGenericResolveTypes") ?? []);
    } finally {
      await resolver.dispose();
    }

    // Falls back to the same opaque, AST-derived shape the default path produces.
    expect(parsed.props).toEqual([]);
  }, 30_000);
});
