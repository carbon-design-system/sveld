import { lstatSync } from "node:fs";
import { resolve } from "node:path";
import {
  type ComponentDocApi,
  type ComponentDocs,
  type ComponentParseError,
  collectComponents,
  collectSvelteFilePaths,
  createGlobMergeState,
  type GenerateBundleResult,
  mergeGlobbedComponents,
  type ProcessComponentOptions,
  processComponent,
  readFileMap,
  reportParseErrors,
} from "./bundle";
import { buildReverseDeps, expandAffected } from "./dependency-graph";
import { dedupeDiagnostics } from "./diagnostics";
import { resetDirectoryListings } from "./fs-listing";
import { type InlinedTypes, inlineLocalTypeImports } from "./inline-types";
import { type EntryExports, parseEntryExports } from "./parse-entry-exports";
import type { ParsedExports } from "./parse-exports";
import { loadParserStack } from "./parser-stack";
import { SVELTE_EXT_REGEX } from "./path";
import type { WriteTsDefinitionOptions } from "./writer/writer-ts-definitions-core";

/** Result of an incremental update. */
interface SveldBundleUpdate {
  /** The full, updated bundle result (all components, with the affected ones re-parsed). */
  result: GenerateBundleResult;
  /**
   * Absolute paths of the components that were re-parsed: the changed files,
   * newly barrel-exported components, plus their transitive dependents via
   * `@extendProps` / `@extends` or a typedef `import("./x")` reference.
   * Other components are reused from the previous parse.
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
 * @param typesInline - Mirrors `typesOptions.inline`; scoped to the components actually affected
 *   by each `update()` (the reparsed ones, plus any component whose inline dependency file itself
 *   changed), so edits to an inlined source are picked up on the next debounced flush without
 *   re-resolving every other component's type imports too.
 */
export async function createSveldBundle(
  input: string,
  glob: boolean,
  documentExports = false,
  typesInline?: WriteTsDefinitionOptions["inline"],
): Promise<SveldBundle> {
  const inputIsFile = lstatSync(input).isFile();
  // Watched so editing the barrel (adding/removing/renaming an export) is
  // picked up without restarting the dev server; `null` for a directory
  // entry, which has no barrel to watch.
  const resolvedInput = inputIsFile ? resolve(input) : null;

  // Export map and `allComponentEntries` are re-collected in `update()` when
  // the entry barrel itself changes; otherwise stable across edits (glob
  // mode still re-globs `allComponentEntries` on every update, see below).
  const initial = collectComponents(input, glob, documentExports);
  const rootDir = initial.rootDir;
  let exports = initial.exports;
  let allComponentEntries = initial.allComponentEntries;
  let resolveComponentFilePath = initial.resolveComponentFilePath;

  let entryExports: EntryExports = documentExports && inputIsFile ? await parseEntryExports(resolve(input)) : [];

  let exportEntries = Object.entries(exports);

  // Dedupes re-glob adds in `update()` by resolved path, including when two
  // components share a basename. Rebuilt whenever the entry barrel changes.
  let globMergeState = createGlobMergeState(allComponentEntries, resolveComponentFilePath);

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

  // Persisted across accesses/flushes so an unaffected component's inline result is reused rather
  // than recomputed (re-reading and re-parsing its type-import dependency files) on every single
  // `.result`/`update()` call. Kept in sync with `allComponentsForTypes` by `refreshInlinedTypes`.
  const inlinedTypesByFilePath = new Map<string, InlinedTypes>();
  // Absolute path of a file read while inlining -> the component `filePath`s whose inline result
  // depends on it. A dependency is never itself re-parsed as a component (it's a plain `.ts` file,
  // not a barrel export), so without this, an edit to it would go unnoticed by the reparse-scoping
  // above; `update()` consults this to fold the dependency's owners into the refresh scope.
  const inlineDepsReverse = new Map<string, Set<string>>();

  /**
   * Recomputes `typesOptions.inline` results for exactly `scope`, merging into the persisted map
   * and refreshing `inlineDepsReverse` for it. Called with the full component set after the
   * initial parse, then with the reparsed subset (plus any component whose recorded dependency
   * changed) after each `update()` - an edit to one component's type-import dependency never pays
   * for re-resolving every other component's.
   */
  const refreshInlinedTypes = (scope: ComponentDocs): void => {
    if (typesInline !== "local" && typesInline !== "all") return;
    for (const component of scope.values()) {
      inlinedTypesByFilePath.delete(component.filePath);
      for (const dependents of inlineDepsReverse.values()) dependents.delete(component.filePath);
    }
    for (const [filePath, inlined] of inlineLocalTypeImports(scope, resolveComponentFilePath)) {
      inlinedTypesByFilePath.set(filePath, inlined);
      for (const dependency of inlined.dependencies) {
        let dependents = inlineDepsReverse.get(dependency);
        if (!dependents) {
          dependents = new Set();
          inlineDepsReverse.set(dependency, dependents);
        }
        dependents.add(filePath);
      }
    }
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
    inlinedTypesByFilePath: typesInline === "local" || typesInline === "all" ? inlinedTypesByFilePath : undefined,
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
      if (result) allComponentsForTypes.set(result.filePath, result);
    }
    refreshInlinedTypes(allComponentsForTypes);
    reportParseErrors(buildResult().errors);
  }

  // Rebuilt after every update so `@extends` edges stay current.
  let reverseDeps = buildReverseDeps(allComponentsForTypes, resolveComponentFilePath);

  /**
   * Re-parses only the entries whose resolved source is in `affected`, writing
   * results back into `target`. Returns the set of paths that were re-parsed.
   *
   * `keyFor` chooses the map key. `components` uses `moduleName` from the
   * barrel export. `allComponentsForTypes` uses `filePath` so two globbed
   * components that share a basename stay distinct.
   */
  const reparseInto = (
    target: ComponentDocs,
    keyFor: (result: ComponentDocApi) => string,
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
        target.set(keyFor(result), result);
        reparsed.add(resolvedPath);
      } else {
        // Drop stale entry when the source vanished or failed to parse.
        for (const [key, api] of target) {
          if (resolveComponentFilePath(api.filePath) === resolvedPath) {
            target.delete(key);
          }
        }
      }
    }
    return reparsed;
  };

  const update = async (changedFilePaths: string[]): Promise<SveldBundleUpdate> => {
    const resolvedChanged = changedFilePaths.map((path) => resolve(path));
    // A rebuild may resolve imports against files added since the last pass.
    resetDirectoryListings();

    if (resolvedChanged.length === 0) {
      return { result: buildResult(), reparsed: [] };
    }

    // Components whose inline result depends on a file that just changed, even though the
    // component's own source didn't - resolved from the reverse map built by the last
    // `refreshInlinedTypes` call, since `reverseDeps` only tracks `@extendProps`/typedef edges.
    const inlineTypeAffectedFilePaths = new Set<string>();
    for (const changed of resolvedChanged) {
      const dependents = inlineDepsReverse.get(changed);
      if (dependents) for (const filePath of dependents) inlineTypeAffectedFilePaths.add(filePath);
    }

    const entryChanged = resolvedInput !== null && resolvedChanged.includes(resolvedInput);
    const addedComponentPaths: string[] = [];

    if (entryChanged) {
      // Re-run export collection on the entry barrel: a name that disappears
      // is dropped from `components` outright (its file may still surface via
      // `--glob`); a name that appears is treated as changed so the normal
      // reparse path below parses it for the first time.
      const recollected = collectComponents(input, glob, documentExports);
      const oldNames = new Set(Object.keys(exports));
      const newNames = new Set(Object.keys(recollected.exports));

      for (const name of oldNames) {
        if (!newNames.has(name)) components.delete(name);
      }
      for (const name of newNames) {
        if (!oldNames.has(name)) {
          addedComponentPaths.push(recollected.resolveComponentFilePath(recollected.exports[name].source));
        }
      }

      exports = recollected.exports;
      allComponentEntries = recollected.allComponentEntries;
      resolveComponentFilePath = recollected.resolveComponentFilePath;
      exportEntries = Object.entries(exports);
      globMergeState = createGlobMergeState(allComponentEntries, resolveComponentFilePath);

      if (documentExports && inputIsFile) {
        entryExports = await parseEntryExports(resolve(input));
      }
    }

    // Pick up components created since the last parse.
    if (glob) {
      mergeGlobbedComponents(rootDir, exports, allComponentEntries, resolveComponentFilePath, globMergeState);
    }

    // Non-`.svelte` changes only matter when they're a known dependency
    // target (an `@extendProps`/`@extends` file or a typedef `import(...)`
    // target); anything else (README, CSS, ...) is ignored here.
    const relevantChanged = resolvedChanged.filter((path) => SVELTE_EXT_REGEX.test(path) || reverseDeps.has(path));

    if (relevantChanged.length === 0 && addedComponentPaths.length === 0) {
      // Nothing needs a component re-parse, but a changed file may still be an inline dependency.
      if (inlineTypeAffectedFilePaths.size > 0) {
        const affectedForTypes: ComponentDocs = new Map();
        for (const [key, component] of allComponentsForTypes) {
          if (inlineTypeAffectedFilePaths.has(component.filePath)) affectedForTypes.set(key, component);
        }
        refreshInlinedTypes(affectedForTypes);
      }
      return { result: buildResult(), reparsed: [] };
    }

    const affected = expandAffected([...relevantChanged, ...addedComponentPaths], reverseDeps);

    // Clear diagnostics for files about to be re-parsed.
    for (const [filePath, error] of parseErrors) {
      if (affected.has(resolveComponentFilePath(error.filePath))) {
        parseErrors.delete(filePath);
      }
    }

    // Read fresh contents for the affected files only.
    const fileMap = await readFileMap(affected);

    const reparsed = new Set<string>();
    for (const path of reparseInto(components, (result) => result.moduleName, exportEntries, affected, fileMap)) {
      reparsed.add(path);
    }
    for (const path of reparseInto(
      allComponentsForTypes,
      (result) => result.filePath,
      allComponentEntries,
      affected,
      fileMap,
    )) {
      reparsed.add(path);
    }

    // Refresh the dependency graph after re-parsing.
    reverseDeps = buildReverseDeps(allComponentsForTypes, resolveComponentFilePath);

    // Only the reparsed components, plus any component whose inline dependency just changed, need
    // their inline results recomputed; every other component's type-import dependencies are
    // unchanged. Drop entries for components removed since the last update (a deleted file no
    // longer has anything to carry forward).
    const reparsedForTypes: ComponentDocs = new Map();
    for (const [key, component] of allComponentsForTypes) {
      if (
        reparsed.has(resolveComponentFilePath(component.filePath)) ||
        inlineTypeAffectedFilePaths.has(component.filePath)
      ) {
        reparsedForTypes.set(key, component);
      }
    }
    refreshInlinedTypes(reparsedForTypes);
    for (const filePath of inlinedTypesByFilePath.keys()) {
      if (!allComponentsForTypes.has(filePath)) inlinedTypesByFilePath.delete(filePath);
    }

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
