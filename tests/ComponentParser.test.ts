import * as test from "tape";
import * as fs from "fs-extra";
import * as path from "path";
import ComponentParser from "../src/ComponentParser";

const SNAPSHOTS_FOLDER = path.join(process.cwd(), "tests", "snapshots");
const INPUT_FILE = "input.svelte";
const OUTPUT_FILE = "output.json";

test("ComponentParser", async (t) => {
  const input_files = fs.readdirSync(SNAPSHOTS_FOLDER);
  const parser = new ComponentParser({ verbose: true });

  for await (const file of input_files) {
    const input_path = path.join(SNAPSHOTS_FOLDER, file, INPUT_FILE);
    const output_path = path.join(SNAPSHOTS_FOLDER, file, OUTPUT_FILE);
    const source = await fs.readFile(input_path, "utf-8");
    const parsed_component = parser.parseSvelteComponent(source, {
      moduleName: "input",
      filePath: input_path,
    });

    t.assert(parsed_component);

    await fs.writeFile(output_path, JSON.stringify(parsed_component, null, 2));
  }

  parser.cleanup();
  t.end();
});
