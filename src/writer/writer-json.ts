import path from "node:path";
import { info } from "../logger";
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

async function writeJsonComponents(components: ComponentDocs, options: WriteJsonOptions) {
  const document = buildComponentApiDocument(components);
  const output = withNormalizedFilePaths(document.components, options.inputDir);

  await Promise.all(
    output.map(async (c) => {
      const outFile = path.resolve(path.join(options.outDir || "", `${c.moduleName}.api.json`));
      const writer = createJsonWriter();
      const wasWritten = await writer.write(outFile, `${JSON.stringify(c, null, 2)}\n`);
      info(`${wasWritten ? "created" : "unchanged"} "${outFile}".`);
    }),
  );
}

async function writeJsonLocal(components: ComponentDocs, options: WriteJsonOptions) {
  const document = buildComponentApiDocument(components, { entryExports: options.entryExports });
  const output: ComponentApiDocument = {
    ...document,
    components: withNormalizedFilePaths(document.components, options.inputDir),
  };

  const output_path = path.join(process.cwd(), options.outFile);
  const writer = createJsonWriter();
  await writer.write(output_path, `${JSON.stringify(output, null, 2)}\n`);

  info(`created "${options.outFile}".`);
}

/**
 * @example
 * ```ts
 * // Per-component files:
 * await writeJson(components, {
 *   inputDir: "./src",
 *   outDir: "./dist"
 * });
 *
 * // Single combined file:
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
