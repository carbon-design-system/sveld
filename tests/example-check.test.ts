import path from "node:path";
import { asNormalizedPath } from "../src/brands";
import ComponentParser from "../src/ComponentParser";
import { collectExampleSources } from "../src/example-check";
import { TypeResolver } from "../src/resolve-types";

const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "example-check");
const COMPONENT_PATH = path.join(FIXTURE_DIR, "input.svelte");
const ARGUMENT_REGEX = /argument/i;

async function parseFixture() {
  const source = await Bun.file(COMPONENT_PATH).text();
  const parser = new ComponentParser();
  return parser.parseSvelteComponent(source, {
    moduleName: "ExampleCheck",
    filePath: asNormalizedPath(COMPONENT_PATH),
  });
}

describe("collectExampleSources", () => {
  test("collects plain TS/JS examples and skips markup examples", async () => {
    const parsed = await parseFixture();
    const sources = collectExampleSources(parsed);
    const byId = Object.fromEntries(sources.map((source) => [source.id, source]));

    expect(Object.keys(byId).sort()).toEqual(["prop:formatValue", "prop:newFormatName", "prop:tooManyArgs"]);
    expect(byId["prop:formatValue"]).toMatchObject({ name: "formatValue", type: "(value: any) => any" });
    expect(byId["prop:formatValue"].code).toBe('formatValue("ok");');
  });
});

describe("opt-in @example compile checking", () => {
  test("flags a renamed symbol and a wrong-arity call, leaves a valid example untouched", async () => {
    const parsed = await parseFixture();
    const sources = collectExampleSources(parsed);

    const resolver = await TypeResolver.create(FIXTURE_DIR);
    expect(resolver).not.toBeNull();
    if (!resolver) return;

    try {
      const diagnosticsByModule = await resolver.checkExamples([
        { moduleName: "ExampleCheck", filePath: COMPONENT_PATH, sources },
      ]);

      const diagnostics = diagnosticsByModule.get("ExampleCheck") ?? [];
      const byId = Object.fromEntries(diagnostics.map((d) => [d.id, d]));

      expect(byId["prop:formatValue"]).toBeUndefined();

      expect(byId["prop:newFormatName"]?.message).toContain("oldFormatName");
      expect(byId["prop:tooManyArgs"]?.message).toMatch(ARGUMENT_REGEX);
    } finally {
      await resolver.dispose();
    }
  }, 30_000);
});
