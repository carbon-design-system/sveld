import path from "node:path";
import { Glob } from "bun";
import { asNormalizedPath } from "../src/brands";
import ComponentParser from "../src/ComponentParser";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions";

const folder = path.join(process.cwd(), "tests", "fixtures");
const fixtures_map = new Map<string, string>();

for await (const file of new Glob("**/input.svelte").scan(folder)) {
  const source = await Bun.file(path.join(folder, file)).text();
  // Normalize path separators for cross-platform compatibility.
  const normalizedFile = file.replace(/\\/g, "/");
  fixtures_map.set(normalizedFile, source);
}

const parser = new ComponentParser();
const files = Array.from(fixtures_map.keys());

/**
 * Fixtures whose `output.json` keeps source ranges, together covering every
 * kind of item that carries one. Every other fixture drops them: a parser
 * change that shifts positions would otherwise rewrite hundreds of goldens.
 */
const SOURCE_RANGE_FIXTURES = new Set([
  "jsdoc-internal-ignore",
  "module-reexport",
  "runes-generics",
  "runes-props-basic",
  "theme-component",
  "typedef-event-shared-block",
]);

/** Drops every `source: { start, end }` range; string `source` fields (module paths) stay. */
const stripSourceRanges = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripSourceRanges);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "source" && entry && typeof entry === "object" && "start" in entry) continue;
    result[key] = stripSourceRanges(entry);
  }
  return result;
};

const getMetadata = (fixture: { filePath: string; source: string }) => {
  const { filePath, source } = fixture;
  const { dir } = path.parse(filePath);
  const moduleName = dir
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const metadata = { moduleName, filePath: asNormalizedPath(filePath) };
  const parsed_component = parser.parseSvelteComponent(source, {
    filePath,
    moduleName,
  });

  return { dir, metadata, parsed_component };
};

// Each fixture owns its expected output as a committed file alongside its
// input.svelte, instead of a shared snapshot file. This keeps regressions
// scoped to the fixture that changed and avoids merge conflicts between
// unrelated fixture updates.
//
// `bun run test:update` (SVELD_UPDATE_FIXTURES=1) rewrites the outputs so the
// change shows up in `git diff`; a plain run only compares, so a regression
// keeps failing and a missing output file fails instead of being created.
const updateFixtures = process.env.SVELD_UPDATE_FIXTURES === "1";

const expectMatchesFixtureFile = async (outputPath: string, actual: string) => {
  if (updateFixtures) {
    await Bun.write(outputPath, actual);
    return;
  }

  const file = Bun.file(outputPath);
  if (!(await file.exists())) {
    throw new Error(`Missing ${path.relative(process.cwd(), outputPath)}; run \`bun run test:update\` and review it.`);
  }
  expect(actual).toBe(await file.text());
};

describe("fixtures (JSON)", async () => {
  test.each(files)("%p", async (filePath) => {
    const source = fixtures_map.get(filePath);
    if (!source) {
      throw new Error(`Source not found for: ${filePath}`);
    }
    const { dir, parsed_component } = getMetadata({ filePath, source });
    const api = SOURCE_RANGE_FIXTURES.has(dir) ? parsed_component : stripSourceRanges(parsed_component);
    const api_json = `${JSON.stringify(api, null, 2)}\n`;

    await expectMatchesFixtureFile(path.join(folder, dir, "output.json"), api_json);
  });
});

describe("fixtures (TypeScript)", async () => {
  test.each(files)("%p", async (filePath) => {
    const source = fixtures_map.get(filePath);
    if (!source) {
      throw new Error(`Source not found for: ${filePath}`);
    }
    const { dir, metadata, parsed_component } = getMetadata({ filePath, source });
    const component = { ...metadata, ...parsed_component };

    const api_ts_class = writeTsDefinition(component, { format: "class" });
    const api_ts_component = writeTsDefinition(component, { format: "component" });

    await expectMatchesFixtureFile(path.join(folder, dir, "output-class.d.ts"), api_ts_class);
    await expectMatchesFixtureFile(path.join(folder, dir, "output-component.d.ts"), api_ts_component);
  });
});
