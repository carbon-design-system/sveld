import { lstatSync } from "node:fs";
import { resolve } from "node:path";
import {
  type ComponentDocs,
  type ComponentParseError,
  collectComponents,
  collectSvelteFilePaths,
  type GenerateBundleResult,
  globComponentSources,
  type ProcessComponentOptions,
  processComponent,
  readFileMap,
  reportParseErrors,
} from "./bundle";
import { buildReverseDeps, expandAffected } from "./dependency-graph";
import { dedupeDiagnostics } from "./diagnostics";
import { type EntryExports, parseEntryExports } from "./parse-entry-exports";
import type { ParsedExports } from "./parse-exports";
import { loadParserStack } from "./parser-stack";

const SVELTE_EXT_REGEX = /\.svelte$/;

/** Result of an incremental update. */
export interface SveldBundleUpdate {
  /** The full, updated bundle result (all components, with the affected ones re-parsed). */
  result: GenerateBundleResult;
  /**
   * Absolute paths of the components that were re-parsed: the changed files
   * plus their transitive `@extendProps` / `@extends` dependents. Other
   * components are reused from the previous parse.
   */
  reparsed: string[];
}

/**
 * A long-lived bundle that supports scoped, incremental re-parsing.
 *
 * `createSveldBundle` performs the initial full parse. `update` then re-parses
 * only the components affected by a set of changed files, leaving every other
 * component's previously-parsed output untouched. This is the core of the
 * plugin's watch mode.
 */
export interface SveldBundle {
  readonly result: GenerateBundleResult;
  /** Re-parse the changed files plus their dependents and return the updated bundle. */
  update(changedFilePaths: string[]): Promise<SveldBundleUpdate>;
}

/**
 * Creates a watch-mode bundle for the given entry point, performing the initial
 * full parse up front.
 *
 * @param input - Entry point file or directory containing Svelte components
 * @param glob - Whether to glob for all `.svelte` files in the directory
 * @param documentExports - Record consts, functions, and types from the entry barrel
 */
export async function createSveldBundle(input: string, glob: boolean, documentExports = false): Promise<SveldBundle> {
  // Export map is stable per edit; re-glob `allComponents` in `update()` when files are added.
  const { exports, allComponents, rootDir, resolveComponentFilePath } = collectComponents(input, glob, documentExports);

  const entryExports: EntryExports =
    documentExports && lstatSync(input).isFile() ? await parseEntryExports(resolve(input)) : [];

  const exportEntries = Object.entries(exports);
  const allComponentEntries = Object.entries(allComponents);

  const components: ComponentDocs = new Map();
  const allComponentsForTypes: ComponentDocs = new Map();

  // Watch mode always parses (it has no on-disk cache integration), so load
  // the parser stack unconditionally up front rather than per-component.
  await loadParserStack();

  // Diagnostics keyed by normalized path so incremental updates can clear them.
  const parseErrors = new Map<string, ComponentParseError>();
  const processOptions: ProcessComponentOptions = {
    onParseError: (error) => parseErrors.set(error.filePath, error),
  };

  const buildResult = (): GenerateBundleResult => ({
    exports,
    entryExports,
    components,
    allComponentsForTypes,
    errors: Array.from(parseErrors.values()),
    diagnostics: dedupeDiagnostics(
      Array.from(allComponentsForTypes.values()).flatMap((component) => component.diagnostics ?? []),
    ),
  });

  // Initial full parse.
  {
    const uniqueFilePaths = collectSvelteFilePaths([exportEntries, allComponentEntries], resolveComponentFilePath);
    const fileMap = await readFileMap(uniqueFilePaths);

    for (const entry of exportEntries) {
      const result = processComponent(entry, exportEntries, fileMap, resolveComponentFilePath, processOptions);
      if (result) components.set(result.moduleName, result);
    }
    for (const entry of allComponentEntries) {
      const result = processComponent(entry, allComponentEntries, fileMap, resolveComponentFilePath, processOptions);
      if (result) allComponentsForTypes.set(result.moduleName, result);
    }
    reportParseErrors(buildResult().errors);
  }

  // Rebuilt after every update so `@extends` edges stay current.
  let reverseDeps = buildReverseDeps(allComponentsForTypes, resolveComponentFilePath);

  /**
   * Re-parses only the entries whose resolved source is in `affected`, writing
   * results back into `target`. Returns the set of paths that were re-parsed.
   */
  const reparseInto = (
    target: ComponentDocs,
    entries: Array<[string, ParsedExports[string]]>,
    affected: Set<string>,
    fileMap: Map<string, string | null>,
  ): Set<string> => {
    const reparsed = new Set<string>();
    for (const entry of entries) {
      const resolvedPath = resolveComponentFilePath(entry[1].source);
      if (!affected.has(resolvedPath)) continue;

      const result = processComponent(entry, entries, fileMap, resolveComponentFilePath, processOptions);
      if (result) {
        target.set(result.moduleName, result);
        reparsed.add(resolvedPath);
      } else {
        // Drop stale entry when the source vanished or failed to parse.
        for (const [moduleName, api] of target) {
          if (resolveComponentFilePath(api.filePath) === resolvedPath) {
            target.delete(moduleName);
          }
        }
      }
    }
    return reparsed;
  };

  const update = async (changedFilePaths: string[]): Promise<SveldBundleUpdate> => {
    const changed = changedFilePaths.filter((path) => SVELTE_EXT_REGEX.test(path)).map((path) => resolve(path));

    if (changed.length === 0) {
      return { result: buildResult(), reparsed: [] };
    }

    // Pick up components created since the last parse.
    if (glob) {
      for (const { moduleName, source } of globComponentSources(rootDir)) {
        const existing = allComponents[moduleName];
        if (existing) {
          existing.source = source;
        } else {
          const newEntry = { source, default: false };
          allComponents[moduleName] = newEntry;
          allComponentEntries.push([moduleName, newEntry]);
        }
      }
    }

    const affected = expandAffected(changed, reverseDeps);

    // Clear diagnostics for files about to be re-parsed.
    for (const [filePath, error] of parseErrors) {
      if (affected.has(resolveComponentFilePath(error.filePath))) {
        parseErrors.delete(filePath);
      }
    }

    // Read fresh contents for the affected files only.
    const fileMap = await readFileMap(affected);

    const reparsed = new Set<string>();
    for (const path of reparseInto(components, exportEntries, affected, fileMap)) {
      reparsed.add(path);
    }
    for (const path of reparseInto(allComponentsForTypes, allComponentEntries, affected, fileMap)) {
      reparsed.add(path);
    }

    // Refresh the dependency graph after re-parsing.
    reverseDeps = buildReverseDeps(allComponentsForTypes, resolveComponentFilePath);

    const result = buildResult();
    reportParseErrors(result.errors);

    return {
      result,
      reparsed: Array.from(reparsed),
    };
  };

  return {
    get result() {
      return buildResult();
    },
    update,
  };
}
