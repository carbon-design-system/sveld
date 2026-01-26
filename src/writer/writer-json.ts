import path from "node:path";
import { normalizeSeparators } from "../path";
import type { ComponentDocApi, ComponentDocs } from "../rollup-plugin";
import { createJsonWriter } from "./Writer";

export interface WriteJsonOptions {
  input: string;
  inputDir: string;
  outFile: string;
  outDir?: string;
}

interface JsonOutput {
  total: number;
  components: ComponentDocApi[];
}

function transformAndSortComponents(components: ComponentDocs, inputDir: string): ComponentDocApi[] {
  return Array.from(components, ([_moduleName, component]) => ({
    ...component,
    filePath: normalizeSeparators(path.join(inputDir, path.normalize(component.filePath))),
  })).sort((a, b) => a.moduleName.localeCompare(b.moduleName));
}

async function writeJsonComponents(components: ComponentDocs, options: WriteJsonOptions) {
  const output = transformAndSortComponents(components, options.inputDir);

  await Promise.all(
    output.map((c) => {
      const outFile = path.resolve(path.join(options.outDir || "", `${c.moduleName}.api.json`));
      const writer = createJsonWriter();
      console.log(`created ${outFile}"\n`);
      return writer.write(outFile, JSON.stringify(c));
    }),
  );
}

async function writeJsonLocal(components: ComponentDocs, options: WriteJsonOptions) {
  const output: JsonOutput = {
    total: components.size,
    components: transformAndSortComponents(components, options.inputDir),
  };

  const output_path = path.join(process.cwd(), options.outFile);
  const writer = createJsonWriter();
  await writer.write(output_path, JSON.stringify(output));

  console.log(`created "${options.outFile}".\n`);
}

export default async function writeJson(components: ComponentDocs, options: WriteJsonOptions) {
  if (options.outDir) {
    await writeJsonComponents(components, options);
  } else {
    await writeJsonLocal(components, options);
  }
}
