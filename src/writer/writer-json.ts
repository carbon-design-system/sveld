import * as path from "path";
import { normalizeSeparators } from "../path";
import { ComponentDocApi, ComponentDocs } from "../rollup-plugin";
import Writer from "./Writer";

export interface WriteJsonOptions {
  input: string;
  inputDir: string;
  outFile: string;
}

interface JsonOutput {
  total: number;
  components: ComponentDocApi[];
}

export default async function writeJson(components: ComponentDocs, options: WriteJsonOptions) {
  const output: JsonOutput = {
    total: components.size,
    components: Array.from(components, ([moduleName, component]) => ({
      ...component,
      filePath: normalizeSeparators(path.join(options.inputDir, path.normalize(component.filePath))),
    })).sort((a, b) => {
      if (a.moduleName < b.moduleName) return -1;
      if (a.moduleName > b.moduleName) return 1;
      return 0;
    }),
  };

  const output_path = path.join(process.cwd(), options.outFile);
  const writer = new Writer({ parser: "json", printWidth: 80 });
  await writer.write(output_path, JSON.stringify(output));

  console.log(`created "${options.outFile}".\n`);
}
