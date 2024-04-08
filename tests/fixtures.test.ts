import fg from "fast-glob";
import fs from "node:fs"
import fsp from "node:fs/promises";
import path from "node:path";
import ComponentParser from "../src/ComponentParser";
import Writer from "../src/writer/Writer";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions";

const folder = path.join(process.cwd(), "tests", "fixtures");
const svelteFiles = fg.sync(["**/*.svelte"], { cwd: folder });
const fixtures = svelteFiles.map((file) => {
  return {
    path: file,
    source: fs.readFileSync(path.join(folder, file), "utf-8"),
  };
});

const parser = new ComponentParser();
const writer = new Writer({ parser: "typescript", printWidth: 120 });

const getMetadata = (fixture: (typeof fixtures)[0]) => {
  const { dir } = path.parse(fixture.path);
  const moduleName = dir
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const metadata = { moduleName, filePath: fixture.path };
  const parsed_component = parser.parseSvelteComponent(fixture.source, {
    filePath: fixture.path,
    moduleName,
  });

  return { dir, metadata, parsed_component };
};

describe("fixtures (JSON)", async () => {
  test.concurrent.each(fixtures)("$path", async (fixture) => {
    const { dir, parsed_component } = getMetadata(fixture);
    const api_json = JSON.stringify(parsed_component, null, 2);

    // Snapshot the output; if the test fails, output has changed.
    expect(api_json).toMatchSnapshot();

    // Still write to disk to manually assert types as needed.
    await fsp.writeFile(path.join(folder, dir, "output.json"), api_json);
  });
});

describe("fixtures (TypeScript)", async () => {
  test.concurrent.each(fixtures)("$path", async (fixture) => {
    const { dir, metadata, parsed_component } = getMetadata(fixture);
    const api_ts = writer.format(writeTsDefinition({ ...metadata, ...parsed_component }));

    // Snapshot the output; if the test fails, output has changed.
    expect(api_ts).toMatchSnapshot();

    // Still write to disk to manually assert types as needed.
    await fsp.writeFile(path.join(folder, dir, "output.d.ts"), api_ts);
  });
});
