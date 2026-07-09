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
const expectMatchesFixtureFile = async (outputPath: string, actual: string) => {
  const file = Bun.file(outputPath);
  const expected = (await file.exists()) ? await file.text() : null;

  // Always write the current output so the diff is visible in `git diff`;
  // if this is an intentional change, review and commit the updated file.
  await Bun.write(outputPath, actual);

  if (expected !== null) {
    expect(actual).toBe(expected);
  }
};

describe("fixtures (JSON)", async () => {
  test.each(files)("%p", async (filePath) => {
    const source = fixtures_map.get(filePath);
    if (!source) {
      throw new Error(`Source not found for: ${filePath}`);
    }
    const { dir, parsed_component } = getMetadata({ filePath, source });
    const api_json = `${JSON.stringify(parsed_component, null, 2)}\n`;

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
