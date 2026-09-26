import path from "node:path";
import { removeSvelteExt } from "../create-exports";
import { info } from "../logger";
import type { EntryExports } from "../parse-entry-exports";
import { formatJsonOutput, normalizeComponentFilePath } from "../path";
import type { ComponentDocApi, ComponentDocs } from "../plugin";
import { buildComponentApiDocument, type ComponentApiDocument } from "./document-model";
import Writer from "./Writer";

/** User-settable `jsonOptions`. */
export interface JsonOptions {
  /**
   * Path (relative to the project root) for the single combined JSON
   * document. Ignored when `outDir` is set.
   * @default "COMPONENT_API.json"
   */
  outFile?: string;
  /**
   * Emit one `<ComponentName>.api.json` file per component into this
   * directory instead of the single combined `outFile`.
   */
  outDir?: string;
  /**
   * Include `source`/`componentCommentSource` position ranges in the
   * output. These are the bulk of a large component library's
   * `COMPONENT_API.json` (roughly a quarter of the file for a 150+
   * component library); set to `false` to omit them and shrink the file
   * when consumers don't need exact source positions.
   * @default true
   */
  source?: boolean;
}

/** `JsonOptions` plus the fields the caller (`plugin.ts`) always injects. */
export interface WriteJsonOptions extends JsonOptions {
  outFile: string;
  /** Resolved from `entry`. */
  inputDir: string;
  /** Entry-barrel exports when `documentExports` is on. */
  entryExports?: EntryExports;
}

/** Narrows a `source`/`componentCommentSource` value to an actual `SourceRange`, as opposed to `EntryExport.source` (a module path string). */
function isSourceRange(value: unknown): value is { start: unknown; end: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "start" in value && "end" in value;
}

/**
 * Recursively strips `source`/`componentCommentSource` position ranges from
 * a component (or any nested value), for `jsonOptions.source: false`.
 * `EntryExport.source` (a declaring-module path string, not a range) is
 * left untouched since it fails the `isSourceRange` check.
 */
function stripSourceRanges<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripSourceRanges(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if ((key === "source" || key === "componentCommentSource") && isSourceRange(item)) continue;
      result[key] = stripSourceRanges(item);
    }
    return result as T;
  }
  return value;
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
    filePath: normalizeComponentFilePath(component.filePath, inputDir),
  }));
}

/**
 * JSON output file name for one component.
 *
 * Two `--glob`-discovered components can share a `moduleName` across
 * directories, e.g. `Menu/Menu.svelte` and `icons/Menu.svelte`. Writing
 * both to `${moduleName}.api.json` would silently overwrite one. On
 * collision, name the file from the source path and warn once per colliding
 * name. Unique names keep `${moduleName}.api.json`.
 */
function jsonFileName(component: ComponentDocApi, hasCollision: boolean, warnedModuleNames: Set<string>): string {
  if (!hasCollision) return `${component.moduleName}.api.json`;

  if (!warnedModuleNames.has(component.moduleName)) {
    warnedModuleNames.add(component.moduleName);
    console.warn(
      `Warning: multiple components named "${component.moduleName}" found. ` +
        "Their JSON files are keyed by source path instead of name to avoid overwriting each other.",
    );
  }

  return `${removeSvelteExt(component.filePath)}.api.json`;
}

async function writeJsonComponents(components: ComponentDocs, options: WriteJsonOptions) {
  const document = buildComponentApiDocument(components);
  let output = withNormalizedFilePaths(document.components, options.inputDir);
  if (options.source === false) output = stripSourceRanges(output);

  const moduleNameCounts = new Map<string, number>();
  for (const component of output) {
    moduleNameCounts.set(component.moduleName, (moduleNameCounts.get(component.moduleName) ?? 0) + 1);
  }
  const warnedModuleNames = new Set<string>();

  await Promise.all(
    output.map(async (c) => {
      const hasCollision = (moduleNameCounts.get(c.moduleName) ?? 0) > 1;
      const fileName = jsonFileName(c, hasCollision, warnedModuleNames);
      const outFile = path.resolve(path.join(options.outDir || "", fileName));
      const writer = new Writer();
      const wasWritten = await writer.write(outFile, formatJsonOutput(c));
      info(`${wasWritten ? "created" : "unchanged"} "${outFile}".`);
    }),
  );
}

/**
 * The single combined JSON document, exactly as written to
 * `COMPONENT_API.json`. Shared by `writeJsonLocal`, the CLI's `--stdout`
 * mode, and `sveld()`'s `document`, so the three can't drift.
 */
export function buildJsonDocument(
  components: ComponentDocs,
  options: Pick<WriteJsonOptions, "inputDir" | "entryExports" | "source">,
): ComponentApiDocument {
  const document = buildComponentApiDocument(components, { entryExports: options.entryExports });
  const output: ComponentApiDocument = {
    ...document,
    components: withNormalizedFilePaths(document.components, options.inputDir),
  };
  return options.source === false ? stripSourceRanges(output) : output;
}

/** {@link buildJsonDocument}, serialized. */
export function renderJsonDocument(
  components: ComponentDocs,
  options: Pick<WriteJsonOptions, "inputDir" | "entryExports" | "source">,
): string {
  return formatJsonOutput(buildJsonDocument(components, options));
}

async function writeJsonLocal(components: ComponentDocs, options: WriteJsonOptions) {
  const raw = renderJsonDocument(components, options);
  const output_path = path.resolve(options.outFile);
  const writer = new Writer();
  const wasWritten = await writer.write(output_path, raw);

  info(`${wasWritten ? "created" : "unchanged"} "${options.outFile}".`);
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
