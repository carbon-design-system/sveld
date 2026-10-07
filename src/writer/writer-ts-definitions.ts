import { join, resolve } from "node:path";
import { convertSvelteExt, createExports, createTypeExports, type TypeExportEntry } from "../create-exports";
import { info } from "../logger";
import { hashSource, type ParseCache } from "../parse-cache";
import type { ParsedExports } from "../parse-exports";
import { normalizeSeparators, SVELTE_EXT_REGEX } from "../path";
import type { ComponentDocApi, ComponentDocs } from "../plugin";
import { buildComponentApiDocument, type ComponentApiDocument } from "./document-model";
import Writer from "./Writer";
import {
  exportsTypeName,
  pickEmitOptions,
  propsTypeName,
  serializeEmitOptions,
  type WriteTsDefinitionOptions,
  writeTsDefinition,
} from "./writer-ts-definitions-core";

/**
 * `typesOptions.indexTypes` entries in barrel order. Deduped by source, not export
 * id: `export { default } from` and `export { default as Button } from` name the
 * same component and would otherwise emit its type names twice.
 */
function collectIndexTypeExports(
  document: ComponentApiDocument,
  options: WriteTsDefinitionsOptions,
): TypeExportEntry[] {
  if (!options.indexTypes) return [];

  const useComponentFormat = options.format === "component";
  const processedSources = new Set<string>();
  const entries: TypeExportEntry[] = [];

  for (const exportee of Object.values(options.exports)) {
    if (!exportee.default || !SVELTE_EXT_REGEX.test(exportee.source)) continue;

    const normalizedSource = normalizeSeparators(exportee.source);
    if (processedSources.has(normalizedSource)) continue;
    processedSources.add(normalizedSource);

    const component = document.components.find((candidate) => candidate.filePath === normalizedSource);
    if (!component) continue;

    const names = [propsTypeName(component.moduleName)];
    if (useComponentFormat) names.push(exportsTypeName(component.moduleName));
    entries.push({ source: exportee.source, names });
  }

  return entries;
}

/** The context `typesOptions.transform` receives alongside the generated text. */
export type TransformContext =
  | { kind: "component"; component: ComponentDocApi; filePath: string }
  | { kind: "index"; filePath: string };

/** Runs after the generated-text cache lookup, so a changed transform never serves stale output. */
async function applyTransform(
  transform: WriteTsDefinitionsOptions["transform"],
  text: string,
  context: TransformContext,
): Promise<string> {
  if (!transform) return text;
  try {
    const result = await transform(text, context);
    if (typeof result !== "string") {
      throw new TypeError(`must return a string, got ${typeof result}`);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`sveld: typesOptions.transform failed for "${context.filePath}": ${message}`, { cause: error });
  }
}

export { formatTsProps, getContextDefs, getTypeDefs, writeTsDefinition } from "./writer-ts-definitions-core";

/** User-settable `typesOptions`. */
export interface TypesOptions extends WriteTsDefinitionOptions {
  /**
   * Output directory for generated `.d.ts` files, relative to the project
   * root.
   * @default "types"
   */
  outDir?: string;
  /**
   * Raw text prepended to the generated `index.d.ts` barrel, e.g. a license
   * header.
   * @default ""
   */
  preamble?: string;
  /**
   * Post-processes each generated file's text before it is written. Runs
   * after the generated-text cache, so it applies on every run. Config file
   * or `sveld()` only.
   */
  transform?: (text: string, context: TransformContext) => string | Promise<string>;
  /**
   * Also re-export generated types from `index.d.ts`: each component's
   * `Props` type, and its `Exports` type under `format: "component"`.
   */
  indexTypes?: boolean;
}

/** `TypesOptions` plus the fields the caller (`plugin.ts`) always injects. */
export interface WriteTsDefinitionsOptions extends TypesOptions {
  outDir: string;
  preamble: string;
  /** Resolved from `entry`. */
  inputDir: string;
  /** Computed from the parsed bundle. */
  exports: ParsedExports;
  /**
   * Reuses generated `.d.ts` text across runs for components whose source
   * (and every emit option from `serializeEmitOptions`) hasn't changed.
   * Requires `resolvedPathByFilePath` to key lookups; both come from
   * `GenerateBundleResult`.
   */
  cache?: ParseCache;
  /** See `cache`. Lookups use `component.filePath`. */
  resolvedPathByFilePath?: Map<string, string>;
  /**
   * See `cache`. For components whose output was resolved from other files,
   * so their text is keyed on their content too.
   */
  crossFileResolvedPathByFilePath?: Map<string, string>;
}

/**
 * Key for a component's cached `.d.ts` text: the emit options, plus its
 * name, which comes from the entry barrel rather than its source, so
 * renaming an export (`as Foo` to `as Bar`) misses.
 */
export function generatedTextCacheKey(moduleName: string, emitOptions: WriteTsDefinitionOptions): string {
  return `${moduleName}\n${serializeEmitOptions(emitOptions)}`;
}

export default async function writeTsDefinitions(components: ComponentDocs, options: WriteTsDefinitionsOptions) {
  const ts_base_path = resolve(options.outDir, "index.d.ts");
  const writer = new Writer();
  const document = buildComponentApiDocument(components);
  const typeExports = createTypeExports(collectIndexTypeExports(document, options));
  const indexDTs =
    options.preamble + [createExports(options.exports), typeExports].filter((section) => section !== "").join("\n\n");

  const emitOptions = pickEmitOptions(options);
  const writePromises = document.components.map(async (component) => {
    const ts_filepath = convertSvelteExt(join(options.outDir, component.filePath));
    const relativeFilePath = normalizeSeparators(convertSvelteExt(component.filePath));
    const ownPath = options.resolvedPathByFilePath?.get(component.filePath);
    const crossFilePath = ownPath ? undefined : options.crossFileResolvedPathByFilePath?.get(component.filePath);
    const resolvedPath = ownPath ?? crossFilePath;
    // A cross-file component's source is fixed by its cache entry, but not
    // what it read from other files, which lands in its serialized content.
    const optionsKey = generatedTextCacheKey(component.moduleName, emitOptions);
    const cacheKey = crossFilePath ? `${optionsKey}\n${hashSource(JSON.stringify(component))}` : optionsKey;
    let text = resolvedPath ? options.cache?.getGeneratedText(resolvedPath, cacheKey) : undefined;
    if (text === undefined) {
      text = writeTsDefinition(component, emitOptions);
      if (resolvedPath) options.cache?.setGeneratedText(resolvedPath, cacheKey, text);
    }
    const transformedText = await applyTransform(options.transform, text, {
      kind: "component",
      component,
      filePath: relativeFilePath,
    });
    return writer.write(ts_filepath, transformedText);
  });

  const indexWritePromise = (async () => {
    const transformedIndexDts = await applyTransform(options.transform, indexDTs, {
      kind: "index",
      filePath: "index.d.ts",
    });
    return writer.write(ts_base_path, `${transformedIndexDts}\n`);
  })();

  const written = (await Promise.all([...writePromises, indexWritePromise])).filter(Boolean).length;
  const total = writePromises.length + 1;

  const count = written === 0 ? `unchanged ${total}` : `created ${written} of ${total}`;
  info(`${count} TypeScript definitions in "${options.outDir}".`);
}
