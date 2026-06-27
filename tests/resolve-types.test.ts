import path from "node:path";
import { asNormalizedPath } from "../src/brands";
import ComponentParser, { applyResolvedProps, getParsedComponentTypeScriptMetadata } from "../src/ComponentParser";
import { TypeResolver } from "../src/resolve-types";

const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "runes-whole-props-imported");
const COMPONENT_PATH = path.join(FIXTURE_DIR, "input.svelte");

async function parseFixture() {
  const source = await Bun.file(COMPONENT_PATH).text();
  const parser = new ComponentParser();
  return parser.parseSvelteComponent(source, {
    moduleName: "RunesWholePropsImported",
    filePath: asNormalizedPath(COMPONENT_PATH),
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
});
