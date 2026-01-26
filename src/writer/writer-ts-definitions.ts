import { join } from "node:path";
import { convertSvelteExt, createExports } from "../create-exports";
import type { ParsedExports } from "../parse-exports";
import type { ComponentDocs } from "../rollup-plugin";
import { createTypeScriptWriter } from "./Writer";
import { writeTsDefinition } from "./writer-ts-definitions-core";

// Re-export browser-compatible functions from core
export {
  formatTsProps,
  getContextDefs,
  getTypeDefs,
  writeTsDefinition,
} from "./writer-ts-definitions-core";

export interface WriteTsDefinitionsOptions {
  outDir: string;
  inputDir: string;
  preamble: string;
  exports: ParsedExports;
}

export default async function writeTsDefinitions(components: ComponentDocs, options: WriteTsDefinitionsOptions) {
  const ts_base_path = join(process.cwd(), options.outDir, "index.d.ts");
  const writer = createTypeScriptWriter();
  const indexDTs = options.preamble + createExports(options.exports);

  const writePromises = Array.from(components).map(async ([_moduleName, component]) => {
    const ts_filepath = convertSvelteExt(join(options.outDir, component.filePath));
    await writer.write(ts_filepath, writeTsDefinition(component));
  });

  await Promise.all([...writePromises, writer.write(ts_base_path, indexDTs)]);

  console.log("created TypeScript definitions.");
}
