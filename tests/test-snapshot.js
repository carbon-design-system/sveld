const fs = require("fs-extra");
const path = require("path");
const ComponentParser = require("../lib/ComponentParser").default;
const { writeTsDefinition } = require("../lib/writer/writer-ts-definitions");
const Writer = require("../lib/writer/Writer").default;

const writer = new Writer({ parser: "typescript", printWidth: 120 });
const SNAPSHOTS_FOLDER = path.join(process.cwd(), "tests", "snapshots");
const INPUT_FILE = "input.svelte";
const OUTPUT_FILE = "output.json";
const TS_DEF_FILE = "output.d.ts";

(async () => {
  const input_files = fs.readdirSync(SNAPSHOTS_FOLDER);
  const parser = new ComponentParser({ verbose: true });

  for await (const file of input_files) {
    const input_path = path.join(SNAPSHOTS_FOLDER, file, INPUT_FILE);
    const output_path = path.join(SNAPSHOTS_FOLDER, file, OUTPUT_FILE);
    const ts_def_path = path.join(SNAPSHOTS_FOLDER, file, TS_DEF_FILE);
    const source = await fs.readFile(input_path, "utf-8");
    const parsed_component = parser.parseSvelteComponent(source, {
      moduleName: "Input",
      filePath: input_path,
    });
    const component_api = {
      moduleName: "Input",
      filePath: input_path,
      ...parsed_component,
    };

    await fs.writeFile(output_path, JSON.stringify(parsed_component, null, 2));
    await writer.write(ts_def_path, writeTsDefinition(component_api));
  }

  parser.cleanup();
})();
