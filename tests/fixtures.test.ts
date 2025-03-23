import path from "node:path";
import { Glob } from "bun";
import ComponentParser from "../src/ComponentParser";
import Writer from "../src/writer/Writer";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions";

const folder = path.join(process.cwd(), "tests", "fixtures");
const fixtures_map = new Map<string, string>();

for await (const file of new Glob("**/input.svelte").scan(folder)) {
  const source = await Bun.file(path.join(folder, file)).text();
  fixtures_map.set(file, source);
}

const parser = new ComponentParser();
const writer = new Writer({ parser: "typescript", printWidth: 120 });
const files = Array.from(fixtures_map.keys());

const getMetadata = (fixture: { filePath: string; source: string }) => {
  const { filePath, source } = fixture;
  const { dir } = path.parse(filePath);
  const moduleName = dir
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const metadata = { moduleName, filePath };
  const parsed_component = parser.parseSvelteComponent(source, {
    filePath,
    moduleName,
  });

  return { dir, metadata, parsed_component };
};

describe("fixtures (JSON)", async () => {
  test.each(files)("%p", async (filePath) => {
    const { dir, parsed_component } = getMetadata({
      filePath,
      source: fixtures_map.get(filePath)!,
    });
    const api_json = JSON.stringify(parsed_component, null, 2);

    // Snapshot the output; if the test fails, output has changed.
    expect(api_json).toMatchSnapshot();

    // Still write to disk to manually assert types as needed.
    await Bun.write(path.join(folder, dir, "output.json"), api_json);
  });
});

describe("fixtures (TypeScript)", async () => {
  test.each(files)("%p", async (filePath) => {
    const { dir, metadata, parsed_component } = getMetadata({
      filePath,
      source: fixtures_map.get(filePath)!,
    });
    const api_ts = await writer.format(writeTsDefinition({ ...metadata, ...parsed_component }));

    // Snapshot the output; if the test fails, output has changed.
    expect(api_ts).toMatchSnapshot();

    // Still write to disk to manually assert types as needed.
    await Bun.write(path.join(folder, dir, "output.d.ts"), api_ts);
  });
});
