import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { asRelativeSourcePath } from "./brands";
import type { ResolveComponentFilePath } from "./bundle";
import type { ModuleGraph } from "./module-graph";
import { type ParsedExports, parseExports } from "./parse-exports";
import { compareText } from "./parser/utils";
import { hasSvelteExtension, normalizeSeparators } from "./path";

const HYPHEN_REGEX = /-/g;
const INVALID_MODULE_NAME_CHAR_REGEX = /[^A-Za-z0-9_$]/g;
const LEADING_DIGIT_REGEX = /^[0-9]/;

/**
 * Sanitizes a `moduleName` derived from a file name into a valid identifier:
 * strips characters `.d.ts` can't emit in a declaration name (e.g. the `.`
 * in `my.component.svelte`) and prefixes `_` when the result would start
 * with a digit (e.g. `3d-model.svelte`). Warns when it had to rename,
 * once per name when given a `warned` set.
 */
function sanitizeModuleName(rawModuleName: string, warned?: Set<string>): string {
  const stripped = rawModuleName.replace(INVALID_MODULE_NAME_CHAR_REGEX, "");
  const sanitized = LEADING_DIGIT_REGEX.test(stripped) ? `_${stripped}` : stripped;
  if (sanitized !== rawModuleName && !warned?.has(rawModuleName)) {
    warned?.add(rawModuleName);
    console.warn(`Warning: "${rawModuleName}" is not a valid identifier; using "${sanitized}" instead.`);
  }
  return sanitized;
}

/**
 * Discovered component sources for an entry point, before parsing.
 *
 * `exports` holds explicitly exported components for JSON/Markdown.
 * `allComponentEntries` is a flat list that also includes glob-discovered
 * components for `.d.ts` generation. A map keyed by `moduleName` would drop
 * one of two `.svelte` files that share a basename. `resolveComponentFilePath`
 * maps a component `source` to its absolute path on disk.
 */
export interface CollectedComponents {
  exports: ParsedExports;
  allComponentEntries: Array<[string, ParsedExports[string]]>;
  rootDir: string;
  resolveComponentFilePath: ResolveComponentFilePath;
}

/** A `.svelte` file discovered on disk, before it's merged into `exports`/`allComponentEntries`. */
interface GlobbedComponentSource {
  moduleName: string;
  source: ReturnType<typeof asRelativeSourcePath>;
}

/**
 * Recursively collects absolute paths of every `.svelte` file under `dir`.
 *
 * Skips dotfiles/dot-directories and follows symlinked directories, guarding
 * against symlink cycles via a set of visited real paths. Tolerates a
 * missing `dir` (returns no matches) instead of throwing.
 */
function findSvelteFiles(
  graph: ModuleGraph,
  dir: string,
  results: string[] = [],
  visited = new Set<string>(),
  /** `dir`'s real path when the caller already knows it (see the recursion below). */
  knownRealDir?: string,
): string[] {
  let real: string;
  try {
    real = knownRealDir ?? realpathSync(dir);
  } catch {
    return results;
  }
  if (visited.has(real)) return results;
  visited.add(real);
  const entries = graph.listDirectory(dir);
  if (entries === null) return results;

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = join(dir, entry.name);
    const isSymbolicLink = entry.isSymbolicLink();
    const stat = isSymbolicLink ? statSync(entryPath, { throwIfNoEntry: false }) : entry;
    if (!stat) continue; // Broken symlink.

    if (stat.isDirectory()) {
      // A non-symlink child of a directory whose real path is `real` has real
      // path `real/name`: no `realpathSync` syscall needed. Only symlinked
      // directories can point elsewhere and must be resolved.
      findSvelteFiles(graph, entryPath, results, visited, isSymbolicLink ? undefined : join(real, entry.name));
    } else if (stat.isFile() && entry.name.endsWith(".svelte")) {
      results.push(entryPath);
    }
  }

  return results;
}

/**
 * Globs every `.svelte` file under `rootDir`, resolving each to its module name and source path.
 *
 * Sorted by `source` so walk order does not depend on `readdirSync`, which
 * varies by OS.
 */
function globComponentSources(graph: ModuleGraph, rootDir: string): GlobbedComponentSource[] {
  return findSvelteFiles(graph, rootDir)
    .map((file) => {
      // Every hit ends in `.svelte` and is not a dotfile, so this is `parse(file).name`.
      const moduleName = sanitizeModuleName(basename(file, ".svelte").replace(HYPHEN_REGEX, ""));
      const source = asRelativeSourcePath(normalizeSeparators(`./${relative(rootDir, file)}`));
      return { moduleName, source };
    })
    .sort((a, b) => compareText(a.source, b.source));
}

/** True when an export `source` still needs glob resolution, like `export { X } from "./dir"`. */
function isUnresolvedBarrelSource(source: string): boolean {
  return !hasSvelteExtension(source);
}

/** Whether `candidateSource` is a file located under the directory `dirSource` points at. */
function isWithinSourceDir(dirSource: string, candidateSource: string): boolean {
  const dir = dirSource.endsWith("/") ? dirSource : `${dirSource}/`;
  return candidateSource.startsWith(dir);
}

/**
 * State shared across {@link mergeGlobbedComponents} calls. Dedupes by
 * resolved path, and warns once per colliding basename. Watch mode keeps
 * one instance across re-globs; a one-shot build creates one and drops it.
 */
export interface GlobMergeState {
  seenPaths: Set<string>;
  seenModuleNamePaths: Map<string, string>;
  warnedModuleNames: Set<string>;
}

export function createGlobMergeState(
  entries: Array<[string, ParsedExports[string]]>,
  resolveComponentFilePath: ResolveComponentFilePath,
): GlobMergeState {
  return {
    seenPaths: new Set(entries.map(([, entry]) => resolveComponentFilePath(entry.source))),
    seenModuleNamePaths: new Map(
      entries.map(([moduleName, entry]) => [moduleName, resolveComponentFilePath(entry.source)]),
    ),
    warnedModuleNames: new Set(),
  };
}

/**
 * Merges every glob-discovered `.svelte` file under `rootDir` into `exports`
 * and `allComponentEntries`.
 *
 * When a barrel export still points at a directory, like
 * `export { Button } from "./button"`, match it to the glob hit under that
 * directory with the same basename.
 *
 * Other glob hits each get their own `allComponentEntries` row, tracked in
 * `state` by resolved file path. Files that share a basename both stay in
 * `.d.ts` output. A colliding basename is logged once.
 *
 * Safe to call again with the same `state`. Watch mode re-globs on every
 * edit and skips paths already seen.
 */
export function mergeGlobbedComponents(
  graph: ModuleGraph,
  rootDir: string,
  exports: ParsedExports,
  allComponentEntries: Array<[string, ParsedExports[string]]>,
  resolveComponentFilePath: ResolveComponentFilePath,
  state: GlobMergeState,
): void {
  for (const { moduleName, source } of globComponentSources(graph, rootDir)) {
    const resolvedPath = resolveComponentFilePath(source);

    const exportEntry = exports[moduleName];
    if (exportEntry && isUnresolvedBarrelSource(exportEntry.source) && isWithinSourceDir(exportEntry.source, source)) {
      // Same object sits in `allComponentEntries`, so updating `source` is
      // enough. Swap the old directory path out of `state.seenPaths` for the
      // resolved file path, or the next pass treats it as a basename collision.
      state.seenPaths.delete(resolveComponentFilePath(exportEntry.source));
      exportEntry.source = source;
      state.seenPaths.add(resolvedPath);
      state.seenModuleNamePaths.set(moduleName, resolvedPath);
      continue;
    }

    if (state.seenPaths.has(resolvedPath)) continue;
    state.seenPaths.add(resolvedPath);

    const priorPath = state.seenModuleNamePaths.get(moduleName);
    if (priorPath === undefined) {
      state.seenModuleNamePaths.set(moduleName, resolvedPath);
    } else if (priorPath !== resolvedPath && !state.warnedModuleNames.has(moduleName)) {
      state.warnedModuleNames.add(moduleName);
      console.warn(
        `Warning: multiple components named "${moduleName}" found (${normalizeSeparators(relative(rootDir, priorPath))} and ${normalizeSeparators(relative(rootDir, resolvedPath))}). ` +
          "Both are included in TypeScript definitions, but only one can be the named export.",
      );
    }

    allComponentEntries.push([moduleName, { source, default: false }]);
  }
}

/**
 * Discovers component sources for an entry point without parsing them.
 *
 * Parses the entry's exports (when `input` is a file) and, when `glob` is set,
 * augments the set with every `.svelte` file under the entry directory.
 *
 * @param documentExports - When `true`, log and continue if the entry file fails
 *   the acorn component-export parse (TypeScript-only syntax is common).
 * @param graph - Lists directories for the glob walk and resolves the
 *   barrel's re-exports.
 */
export function collectComponents(
  input: string,
  glob: boolean,
  documentExports: boolean,
  graph: ModuleGraph,
): CollectedComponents {
  const isFile = lstatSync(input).isFile();
  const dir = isFile ? dirname(input) : input;
  const rootDir = resolve(dir);
  // Memoized: the same `source` is resolved several times per run (glob
  // merge, file-path collection, per-component processing, cache lookup).
  const resolvedPaths = new Map<string, string>();
  const resolveComponentFilePath: ResolveComponentFilePath = (filePath) => {
    let resolved = resolvedPaths.get(filePath);
    if (resolved === undefined) {
      resolved = isAbsolute(filePath) ? resolve(filePath) : resolve(rootDir, filePath);
      resolvedPaths.set(filePath, resolved);
    }
    return resolved;
  };

  /**
   * Only parse exports if input is a file.
   * Directory inputs don't have a single entry point to parse exports from.
   */
  let exports: ParsedExports = {};
  if (isFile) {
    const entry = readFileSync(input, "utf-8");
    try {
      exports = parseExports(entry, rootDir, graph, new Set([resolve(input)]));
    } catch (error) {
      // Without documentExports, throw. With it, warn and continue.
      if (!documentExports) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Failed to parse component exports from ${input}: ${message}`);
    }
  }

  const allComponentEntries: Array<[string, ParsedExports[string]]> = Object.entries(exports);

  if (glob) {
    const state = createGlobMergeState(allComponentEntries, resolveComponentFilePath);
    mergeGlobbedComponents(graph, rootDir, exports, allComponentEntries, resolveComponentFilePath, state);

    // A directory entry has no barrel to parse exports from (`exports` is
    // still `{}` at this point), so without this every globbed component
    // would be missing from JSON/Markdown output and the generated index
    // `.d.ts`, even though a per-component `.d.ts` is still produced for
    // each of them via `allComponentEntries`.
    if (!isFile) {
      exports = Object.fromEntries(
        allComponentEntries.map(([moduleName, entry]) => [moduleName, { ...entry, default: true }]),
      );
    }
  }

  return { exports, allComponentEntries, rootDir, resolveComponentFilePath };
}

/**
 * The `moduleName` of an entry: its export name, except that the lone
 * `default` export of a list of `entryCount` entries is named after its
 * file, like a `--glob` component: `my-button.svelte` is `mybutton`.
 */
export function componentModuleName(
  exportName: string,
  source: string,
  entryCount: number,
  warned?: Set<string>,
): string {
  if (entryCount !== 1 || exportName !== "default") return exportName;
  return sanitizeModuleName(parse(source).name.replace(HYPHEN_REGEX, ""), warned);
}
