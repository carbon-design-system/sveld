import { dirname, resolve } from "node:path";
import {
  type ComponentDocApi,
  type ComponentDocs,
  type ComponentParseError,
  collectComponents,
  collectSvelteFilePaths,
  type GenerateBundleResult,
  type ProcessComponentOptions,
  processComponent,
  type ResolveComponentFilePath,
  readFileMap,
  reportParseErrors,
} from "./bundle";
import type { ParsedExports } from "./parse-exports";

const SVELTE_EXT_REGEX = /\.svelte$/;

/** Strips matching surrounding single/double quotes from an import specifier. */
const SURROUNDING_QUOTES_REGEX = /^(['"])(.*)\1$/;

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
 * Resolves a component's `@extendProps` / `@extends` target to an absolute path,
 * or `null` when it doesn't point at a local `.svelte` file (e.g. it references
 * an external package interface like `carbon-components-svelte`).
 */
function resolveExtendsDependency(api: ComponentDocApi, componentPath: string): string | null {
  const raw = api.extends?.import;
  if (raw === undefined) return null;
  // `extends.import` is stored verbatim from the JSDoc tag, including any
  // surrounding quotes (e.g. `"./Button.svelte"`).
  const target = raw.replace(SURROUNDING_QUOTES_REGEX, "$2");
  if (!SVELTE_EXT_REGEX.test(target)) return null;
  return resolve(dirname(componentPath), target);
}

/**
 * Builds a reverse-dependency map: `dependencyPath -> set of dependent paths`.
 *
 * A component is a dependent of `X` when it extends `X` via `@extendProps` /
 * `@extends`. When `X` changes, every dependent must be re-parsed.
 */
function buildReverseDeps(
  components: ComponentDocs,
  resolveComponentFilePath: ResolveComponentFilePath,
): Map<string, Set<string>> {
  const reverse = new Map<string, Set<string>>();

  for (const api of components.values()) {
    const componentPath = resolveComponentFilePath(api.filePath);
    const dependency = resolveExtendsDependency(api, componentPath);
    if (dependency === null) continue;

    let dependents = reverse.get(dependency);
    if (dependents === undefined) {
      dependents = new Set();
      reverse.set(dependency, dependents);
    }
    dependents.add(componentPath);
  }

  return reverse;
}

/**
 * Expands the set of changed paths to include every transitive dependent via
 * the reverse-dependency map (e.g. editing `Button.svelte` also marks the
 * `SecondaryButton.svelte` that `@extendProps`-es it).
 */
function expandAffected(changed: Iterable<string>, reverseDeps: Map<string, Set<string>>): Set<string> {
  const affected = new Set<string>();
  const queue: string[] = [];

  for (const path of changed) {
    if (!affected.has(path)) {
      affected.add(path);
      queue.push(path);
    }
  }

  while (queue.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: queue is non-empty in the loop condition
    const current = queue.shift()!;
    const dependents = reverseDeps.get(current);
    if (dependents === undefined) continue;
    for (const dependent of dependents) {
      if (!affected.has(dependent)) {
        affected.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return affected;
}

/**
 * Creates a watch-mode bundle for the given entry point, performing the initial
 * full parse up front.
 *
 * @param input - Entry point file or directory containing Svelte components
 * @param glob - Whether to glob for all `.svelte` files in the directory
 */
export async function createSveldBundle(input: string, glob: boolean): Promise<SveldBundle> {
  // Discover sources once. The export/source maps only change when the entry
  // file or the set of files on disk changes; for a single edit they are stable.
  const { exports, allComponents, resolveComponentFilePath } = collectComponents(input, glob);

  const exportEntries = Object.entries(exports);
  const allComponentEntries = Object.entries(allComponents);

  const components: ComponentDocs = new Map();
  const allComponentsForTypes: ComponentDocs = new Map();

  // Parse diagnostics, keyed by normalized file path so they survive across
  // incremental updates and can be cleared when a file is re-parsed cleanly.
  const parseErrors = new Map<string, ComponentParseError>();
  const processOptions: ProcessComponentOptions = {
    onParseError: (error) => parseErrors.set(error.filePath, error),
  };

  const buildResult = (): GenerateBundleResult => ({
    exports,
    components,
    allComponentsForTypes,
    errors: Array.from(parseErrors.values()),
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

  // Dependency graph derived from the full parse; rebuilt after every update so
  // that newly added/removed `@extends` edges stay accurate.
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
        // Source vanished or failed to parse: drop the stale entry.
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

    const affected = expandAffected(changed, reverseDeps);

    // Clear stale diagnostics for the files we are about to re-parse; any that
    // still fail will be re-recorded below.
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

    // Refresh the dependency graph from the up-to-date parse.
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
