import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { Glob } from "bun";
import cemSchema from "custom-elements-manifest/schema.json" with { type: "json" };
import { asNormalizedPath, buildCustomElementsManifest, type ComponentDocs, ComponentParser } from "../src/browser";

const root = process.cwd();

// Same representative prefixes as tests/component-api-schema.test.ts: every
// syntax mode plus the typedef/context/slot metadata shapes, without paying
// for all ~90 fixtures on every run.
const FIXTURE_PREFIXES = ["runes-", "legacy-", "typedef-", "context-", "slot-"];

async function buildRepresentativeFixtureComponents(): Promise<ComponentDocs> {
  const fixturesRoot = path.join(root, "tests", "fixtures");
  const parser = new ComponentParser();
  const components: ComponentDocs = new Map();

  for await (const file of new Glob("**/input.svelte").scan(fixturesRoot)) {
    const normalizedFile = file.replace(/\\/g, "/");
    const dir = normalizedFile.slice(0, normalizedFile.length - "/input.svelte".length);
    if (!FIXTURE_PREFIXES.some((prefix) => dir.startsWith(prefix))) continue;

    const filePath = path.join(fixturesRoot, normalizedFile);
    const source = readFileSync(filePath, "utf-8");
    const parsed = parser.parseSvelteComponent(source, { filePath, moduleName: dir });
    components.set(dir, { ...parsed, moduleName: dir, filePath: asNormalizedPath(filePath) });
  }

  return components;
}

describe("Custom Elements Manifest schema", () => {
  // `allowUnionTypes` because the upstream CEM schema uses `type: [string, boolean]`
  // for `deprecated`; everything else stays strict.
  const ajv = new Ajv({ strict: true, allowUnionTypes: true, allErrors: true });
  const validate = ajv.compile(cemSchema);

  function expectValid(manifest: unknown) {
    const valid = validate(manifest);
    if (!valid) {
      throw new Error(`Schema validation failed:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
    }
    expect(valid).toBe(true);
  }

  test("validates the CEM output for representative fixtures", async () => {
    const components = await buildRepresentativeFixtureComponents();
    expect(components.size).toBeGreaterThan(0);

    const manifest = buildCustomElementsManifest(components);
    expectValid(manifest);
  });
});
