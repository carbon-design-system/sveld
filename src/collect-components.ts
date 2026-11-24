import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { asRelativeSourcePath } from "./brands";
import type { ResolveComponentFilePath } from "./bundle";
import type { ModuleGraph } from "./module-graph";
import { type ParsedExports, parseExports } from "./parse-exports";
import { compareText } from "./parser/utils";
import { hasSvelteExtension, normalizeSeparators } from "./path";

const HYPHEN_REGEX = /-/g;
const INVALID_MODULE_NAME_CHAR_REGEX = /[^A-Za-z0-9_$]/g;
const LEADING_DIGIT_REGEX = /^[0-9]/;

// A file-derived name must be a valid `.d.ts` identifier, so invalid
// characters go (`my.component.svelte`) and a leading digit gets a `_`
// (`3d-model.svelte`). A rename warns, only once per name when
// given `warned`.
function sanitizeModuleName(rawModuleName: string, warned?: Set<string>): string {
  const stripped = rawModuleName.replace(INVALID_MODULE_NAME_CHAR_REGEX, "");
  const sanitized = LEADING_DIGIT_REGEX.test(stripped) ? `_${stripped}` : stripped;
  if (sanitized !== rawModuleName && !warned?.has(rawModuleName)) {
    warned?.add(rawModuleName);
    console.warn(`Warning: "${rawModuleName}" is not a valid identifier; using "${sanitized}" instead.`);
  }
  return sanitized;
}

function moduleNameFromFile(file: string, warned?: Set<string>): string {
  return sanitizeModuleName(parse(file).name.replace(HYPHEN_REGEX, ""), warned);
}

export type ComponentEntry = [string, ParsedExports[string]];

/**
 * `exports` holds the barrel's exported components (JSON/Markdown);
 * `allComponentEntries` adds glob-discovered ones (`.d.ts`). It's a list,
 * not a map keyed by `moduleName`, so two files sharing a basename
 * both survive.
 */
export interface CollectedComponents {
  exports: ParsedExports;
  allComponentEntries: ComponentEntry[];
  rootDir: string;
  resolveComponentFilePath: ResolveComponentFilePath;
}

interface GlobbedComponentSource {
  moduleName: string;
  source: ReturnType<typeof asRelativeSourcePath>;
}

// Skips dot-entries. Follows symlinked directories, so cycles are guarded
// against by real path. A missing `dir` yields no matches instead
// of throwing.
function findSvelteFiles(
  graph: ModuleGraph,
  dir: string,
  results: string[] = [],
  visited = new Set<string>(),
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
      // A non-symlink child's real path is `real/name`, saving a `realpathSync`.
      findSvelteFiles(graph, entryPath, results, visited, isSymbolicLink ? undefined : join(real, entry.name));
    } else if (stat.isFile() && entry.name.endsWith(".svelte")) {
      results.push(entryPath);
    }
  }

  return results;
}

// Sorted by `source`, since `readdirSync` order varies by OS.
function globComponentSources(graph: ModuleGraph, rootDir: string): GlobbedComponentSource[] {
  return findSvelteFiles(graph, rootDir)
    .map((file) => ({
      moduleName: moduleNameFromFile(file),
      source: asRelativeSourcePath(normalizeSeparators(`./${relative(rootDir, file)}`)),
    }))
    .sort((a, b) => compareText(a.source, b.source));
}

// A source without `.svelte` (`export { X } from "./dir"`) still needs
// glob resolution.
function isUnresolvedBarrelSource(source: string): boolean {
  return !hasSvelteExtension(source);
}

function isWithinSourceDir(dirSource: string, candidateSource: string): boolean {
  const dir = dirSource.endsWith("/") ? dirSource : `${dirSource}/`;
  return candidateSource.startsWith(dir);
}

/**
 * Shared across {@link mergeGlobbedComponents} calls; watch mode keeps one
 * across re-globs.
 */
export interface GlobMergeState {
  seenPaths: Set<string>;
  seenModuleNamePaths: Map<string, string>;
  warnedModuleNames: Set<string>;
}

export function createGlobMergeState(
  entries: ComponentEntry[],
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

// invariant: idempotent for a given `state`. A barrel export still
// pointing at a directory (`export { Button } from "./button"`) matches
// the same-basename hit under it; every other unseen hit gets its own
// `allComponentEntries` row.
export function mergeGlobbedComponents(
  graph: ModuleGraph,
  rootDir: string,
  exports: ParsedExports,
  allComponentEntries: ComponentEntry[],
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

// Sources only, without parsing them. With `documentExports`, a
// component-export parse that fails on TypeScript-only syntax warns
// instead of throwing, since it reads the entry as JavaScript.
export function collectComponents(
  input: string,
  glob: boolean,
  documentExports: boolean,
  graph: ModuleGraph,
): CollectedComponents {
  const isFile = lstatSync(input).isFile();
  const dir = isFile ? dirname(input) : input;
  const rootDir = resolve(dir);
  // Memoized, since the same `source` is resolved several times per run.
  const resolvedPaths = new Map<string, string>();
  const resolveComponentFilePath: ResolveComponentFilePath = (filePath) => {
    let resolved = resolvedPaths.get(filePath);
    if (resolved === undefined) {
      resolved = isAbsolute(filePath) ? resolve(filePath) : resolve(rootDir, filePath);
      resolvedPaths.set(filePath, resolved);
    }
    return resolved;
  };

  let exports: ParsedExports = {};
  if (isFile) {
    const entry = readFileSync(input, "utf-8");
    try {
      exports = parseExports(entry, rootDir, graph, new Set([resolve(input)]), resolve(input));
    } catch (error) {
      if (!documentExports) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Failed to parse component exports from ${input}: ${message}`);
    }
  }

  const allComponentEntries: ComponentEntry[] = Object.entries(exports);

  if (glob) {
    const state = createGlobMergeState(allComponentEntries, resolveComponentFilePath);
    mergeGlobbedComponents(graph, rootDir, exports, allComponentEntries, resolveComponentFilePath, state);

    // A directory entry has no barrel, so every globbed component is exported
    // (JSON/Markdown and the index `.d.ts` read `exports`).
    if (!isFile) {
      exports = Object.fromEntries(
        allComponentEntries.map(([moduleName, entry]) => [moduleName, { ...entry, default: true }]),
      );
    }
  }

  return { exports, allComponentEntries, rootDir, resolveComponentFilePath };
}

// A lone `default` entry is named after its file instead, like a
// `--glob` component.
export function componentModuleName(
  exportName: string,
  source: string,
  entryCount: number,
  warned?: Set<string>,
): string {
  if (entryCount !== 1 || exportName !== "default") return exportName;
  return moduleNameFromFile(source, warned);
}
