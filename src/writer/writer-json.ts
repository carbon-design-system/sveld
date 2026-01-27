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

/**
 * JSON output structure for component documentation.
 *
 * Contains the total count of components and an array of all
 * component documentation objects.
 */
interface JsonOutput {
  total: number;
  components: ComponentDocApi[];
}

/**
 * Transforms and sorts component documentation for JSON output.
 *
 * Normalizes file paths and sorts components alphabetically by module name.
 *
 * @param components - Map of component documentation
 * @param inputDir - The input directory for normalizing paths
 * @returns Sorted array of component documentation with normalized paths
 *
 * @example
 * ```ts
 * // Input: components with relative paths
 * // Output: components with normalized absolute paths, sorted by name
 * ```
 */
function transformAndSortComponents(components: ComponentDocs, inputDir: string): ComponentDocApi[] {
  return Array.from(components, ([_moduleName, component]) => ({
    ...component,
    filePath: normalizeSeparators(path.join(inputDir, path.normalize(component.filePath))),
  })).sort((a, b) => a.moduleName.localeCompare(b.moduleName));
}

/**
 * Writes individual JSON files for each component.
 *
 * Creates a separate `.api.json` file for each component in the
 * specified output directory. Used when `outDir` is specified.
 *
 * @param components - Map of component documentation
 * @param options - Write options including output directory
 *
 * @example
 * ```ts
 * await writeJsonComponents(components, {
 *   inputDir: "./src",
 *   outDir: "./dist"
 * });
 * // Creates: dist/Button.api.json, dist/Input.api.json, etc.
 * ```
 */
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

/**
 * Writes component documentation to a single JSON file.
 *
 * Creates a JSON file containing all components with metadata.
 * Used when `outDir` is not specified.
 *
 * @param components - Map of component documentation
 * @param options - Write options including output file path
 *
 * @example
 * ```ts
 * await writeJsonLocal(components, {
 *   inputDir: "./src",
 *   outFile: "components.api.json"
 * });
 * // Creates: components.api.json with all component docs
 * ```
 */
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

/**
 * Writes component documentation to JSON format.
 *
 * Can write either:
 * - Individual JSON files per component (when `outDir` is specified)
 * - A single combined JSON file (when only `outFile` is specified)
 *
 * @param components - Map of component documentation to write
 * @param options - Write options including output directory or file
 * @returns A promise that resolves when all files have been written
 *
 * @example
 * ```ts
 * // Write individual files:
 * await writeJson(components, {
 *   inputDir: "./src",
 *   outDir: "./dist"
 * });
 *
 * // Write single file:
 * await writeJson(components, {
 *   inputDir: "./src",
 *   outFile: "components.api.json"
 * });
 * ```
 */
export default async function writeJson(components: ComponentDocs, options: WriteJsonOptions) {
  if (options.outDir) {
    await writeJsonComponents(components, options);
  } else {
    await writeJsonLocal(components, options);
  }
}
