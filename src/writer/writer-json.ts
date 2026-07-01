import path from "node:path";
import type { EntryExports } from "../parse-entry-exports";
import { normalizeSeparators } from "../path";
import type { ComponentDocApi, ComponentDocs } from "../plugin";
import { buildComponentApiDocument, type ComponentApiDocument } from "./document-model";
import { createJsonWriter } from "./Writer";

export interface WriteJsonOptions {
  input: string;
  inputDir: string;
  outFile: string;
  outDir?: string;
  /** Entry-barrel exports when `documentExports` is on. */
  entryExports?: EntryExports;
}

/**
 * Normalizes each component's `filePath` to be resolvable from `cwd`.
 *
 * This is JSON-output-specific: it makes `COMPONENT_API.json` self-describing.
 * Other writers (e.g. `.d.ts`) need the original relative `filePath` to
 * compute their own output locations, so this must not live in the shared
 * document model.
 */
function withNormalizedFilePaths(components: ComponentDocApi[], inputDir: string): ComponentDocApi[] {
  return components.map((component) => ({
    ...component,
    filePath: normalizeSeparators(path.join(inputDir, path.normalize(component.filePath))),
  }));
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
  const document = buildComponentApiDocument(components);
  const output = withNormalizedFilePaths(document.components, options.inputDir);

  await Promise.all(
    output.map((c) => {
      const outFile = path.resolve(path.join(options.outDir || "", `${c.moduleName}.api.json`));
      const writer = createJsonWriter();
      console.log(`created "${outFile}".`);
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
  const document = buildComponentApiDocument(components, { entryExports: options.entryExports });
  const output: ComponentApiDocument = {
    ...document,
    components: withNormalizedFilePaths(document.components, options.inputDir),
  };

  const output_path = path.join(process.cwd(), options.outFile);
  const writer = createJsonWriter();
  await writer.write(output_path, JSON.stringify(output));

  console.log(`created "${options.outFile}".`);
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
