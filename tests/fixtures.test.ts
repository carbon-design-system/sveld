import fg from "fast-glob";
import fsp from "node:fs/promises";
import path from "node:path";
import ComponentParser from "../src/ComponentParser";
import Writer from "../src/writer/Writer";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions";

const folder = path.join(process.cwd(), "tests", "fixtures");

const svelteFiles = fg.sync(["**/*.svelte"], { cwd: folder });
const fixtures = await Promise.all(
  svelteFiles.map(async (file) => {
    return {
      path: file,
      source: await fsp.readFile(path.join(folder, file), "utf-8"),
    };
  })
);

const createMetadata = (filePath: string) => {
  const { dir } = path.parse(filePath);
  const moduleName = dir
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");

  return { dir, moduleName, filePath };
};

const parser = new ComponentParser();
const writer = new Writer({ parser: "typescript", printWidth: 120 });

describe("fixtures (JSON)", async () => {
  test.concurrent.each(fixtures)("$path", async (fixture) => {
    const { dir, ...metadata } = createMetadata(fixture.path);
    const parsed_component = parser.parseSvelteComponent(fixture.source, metadata);
    const api_json = JSON.stringify(parsed_component, null, 2);

    // Snapshot the output; if the test fails, output has changed.
    expect(api_json).toMatchSnapshot();

    // Still write to disk to manually assert types as needed.
    await fsp.writeFile(path.join(folder, dir, "output.json"), api_json);
  });
});

describe("fixtures (TypeScript)", async () => {
  test.concurrent.each(fixtures)("$path", async (fixture) => {
    const { dir, ...metadata } = createMetadata(fixture.path);
    const parsed_component = parser.parseSvelteComponent(fixture.source, metadata);
    const api_ts = writer.format(writeTsDefinition({ ...metadata, ...parsed_component }));

    // Snapshot the output; if the test fails, output has changed.
    expect(api_ts).toMatchSnapshot();

    // Still write to disk to manually assert types as needed.
    await fsp.writeFile(path.join(folder, dir, "output.d.ts"), api_ts);
  });
});
