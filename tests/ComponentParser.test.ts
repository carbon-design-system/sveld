import * as test from "tape";
import * as fs from "fs-extra";
import * as path from "path";
import ComponentParser from "../src/ComponentParser";
import { writeTsDefinition } from "../src/writer/writer-ts-definitions";
import Writer from "../src/writer/Writer";

const writer = new Writer({ parser: "typescript", printWidth: 120 });
const SNAPSHOTS_FOLDER = path.join(process.cwd(), "tests", "snapshots");
const INPUT_FILE = "input.svelte";
const OUTPUT_FILE = "output.json";
const TS_DEF_FILE = "output.d.ts";

test("ComponentParser", async (t) => {
  const input_files = fs.readdirSync(SNAPSHOTS_FOLDER);
  const parser = new ComponentParser({ verbose: true });

  for await (const file of input_files) {
    const input_path = path.join(SNAPSHOTS_FOLDER, file, INPUT_FILE);
    const output_path = path.join(SNAPSHOTS_FOLDER, file, OUTPUT_FILE);
    const ts_def_path = path.join(SNAPSHOTS_FOLDER, file, TS_DEF_FILE);
    const source = await fs.readFile(input_path, "utf-8");
    const parsed_component = parser.parseSvelteComponent(source, {
      moduleName: "input",
      filePath: input_path,
    });
    const component_api = {
      moduleName: "input",
      filePath: input_path,
      ...parsed_component,
    };

    t.assert(parsed_component);

    await fs.writeFile(output_path, JSON.stringify(parsed_component, null, 2));
    await writer.write(ts_def_path, writeTsDefinition(component_api));
  }

  parser.cleanup();
  t.end();
});
