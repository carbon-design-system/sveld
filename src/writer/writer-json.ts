import * as path from "path";
import * as fs from "fs";
import { ComponentDocApi, ComponentDocs } from "../rollup-plugin";
import Writer from "./Writer";

export interface WriteJsonOptions {
  input: string;
  outFile: string;
}

interface JsonOutput {
  total: number;
  components: ComponentDocApi[];
}

export default async function writeJson(components: ComponentDocs, options: WriteJsonOptions) {
  const file_path = fs.lstatSync(options.input).isDirectory() ? options.input : path.dirname(options.input);
  const output: JsonOutput = {
    total: components.size,
    components: Array.from(components, ([moduleName, component]) => ({
      ...component,
      filePath: path.join("/", file_path, component.filePath),
    })),
  };

  const output_path = path.join(process.cwd(), options.outFile);
  const writer = new Writer({ parser: "json", printWidth: 80 });
  await writer.write(output_path, JSON.stringify(output));

  process.stdout.write(`created "${options.outFile}".\n`);
}
