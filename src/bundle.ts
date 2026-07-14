import type { Dirent } from "node:fs";
import { lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { asRelativeSourcePath, type NormalizedPath } from "./brands";
import type { ParsedComponent } from "./ComponentParser";
import { buildReverseDeps, expandAffected } from "./dependency-graph";
import { dedupeDiagnostics, type SveldDiagnostic } from "./diagnostics";
import { collectExampleSources } from "./example-check";
import { hashSource, ParseCache, resolveCacheFilePath } from "./parse-cache";
import { type EntryExports, parseEntryExports } from "./parse-entry-exports";
import { type ParsedExports, parseExports } from "./parse-exports";
import { applyResolvedProps, getParsedComponentTypeScriptMetadata } from "./parsed-component-metadata";
import { getParserStack, loadParserStack } from "./parser-stack";
import { normalizeSeparators } from "./path";
import type { TypeResolver } from "./resolve-types";

export interface ComponentDocApi extends ParsedComponent {
  filePath: NormalizedPath;
  moduleName: string;
}

export type ComponentDocs = Map<string, ComponentDocApi>;

/**
 * A parse failure for a single component, captured so the rest of the run
 * can continue. Surfaced via {@link GenerateBundleResult.errors}.
 */
export interface ComponentParseError {
  filePath: string;
  moduleName: string;
  message: string;
  stack?: string;
}

export interface GenerateBundleResult {
  exports: ParsedExports;
  /** Entry-barrel exports other than components. Empty when `documentExports` is off. */
  entryExports: EntryExports;
  components: ComponentDocs;
  allComponentsForTypes: ComponentDocs;
  /**
   * Components that failed to parse. Empty unless `failFast` is disabled and
   * one or more components threw during parsing.
   */
  errors: ComponentParseError[];
  /** Unknown props, `any` contexts, and orphan `@event` tags across the bundle. */
  diagnostics: SveldDiagnostic[];
}

export interface GenerateBundleOptions {
  /**
   * Throw on the first component that fails to parse instead of collecting
   * the failure and continuing with the remaining components.
   */
  failFast?: boolean;
  /**
   * Load the TypeScript program to expand opaque imported whole-object `$props()`
   * types into JSON/Markdown props. Off by default; requires `typescript`.
   */
  resolveTypes?: boolean;
  /** Record consts, functions, and types from the entry barrel. Off by default. */
  documentExports?: boolean;
  /**
   * Cache parsed component output to disk. Unchanged files skip re-parsing on
   * later runs. On by default, writing to
   * `node_modules/.cache/sveld/parse-cache.json`; a string sets a custom path.
   * Pass `false` to disable.
   */
  cache?: boolean | string;
  /**
   * Run plain TS/JS `@example` blocks on props, module exports, slots, and
   * events through the TypeScript program. Broken examples become
   * `example-compile-error` diagnostics. Svelte/HTML markup is skipped.
   * Off by default. Requires `typescript`.
   */
  checkExamples?: boolean;
  /**
   * Parse as usual (so cache reads and real errors still apply) but skip
   * persisting the parse cache to disk. Set by the CLI's `--dry-run`.
   */
  dryRun?: boolean;
}

export function toGenerateBundleOptions(
  opts?: Pick<
    GenerateBundleOptions,
    "failFast" | "resolveTypes" | "documentExports" | "cache" | "checkExamples" | "dryRun"
  >,
): GenerateBundleOptions {
  return {
    failFast: opts?.failFast,
    resolveTypes: opts?.resolveTypes === true,
    documentExports: opts?.documentExports === true,
    cache: opts?.cache,
    checkExamples: opts?.checkExamples === true,
    dryRun: opts?.dryRun === true,
  };
}

/** A function that resolves a (possibly relative) component path to an absolute path. */
export type ResolveComponentFilePath = (filePath: string) => string;

/** Options controlling how a single component parse failure is handled. */
export interface ProcessComponentOptions {
  /** Rethrow on parse failure instead of reporting it via `onParseError`. */
  failFast?: boolean;
  /** Invoked with a diagnostic when a component fails to parse (and `failFast` is off). */
  onParseError?: (error: ComponentParseError) => void;
  /** When set, reuse a component's previous parse if its content hash is unchanged. */
  cache?: ParseCache;
  /** Resolved file path -> sha256, computed once up front so it isn't re-hashed per pass. */
  hashes?: Map<string, string>;
  /**
   * In-run memo of freshly parsed components, keyed by resolved file path and
   * shared across the exported and all-components passes so a component that
   * appears in both is only parsed once. Only fresh parses are stored here
   * (never disk-cache hits), and an entry is cleared wherever the disk cache
   * is invalidated so the `@extends` dependency-invalidation flow still forces
   * a re-parse.
   */
  memo?: Map<string, ParsedComponent>;
}

const HYPHEN_REGEX = /-/g;

/**
 * Discovered component sources for an entry point, before parsing.
 *
 * `exports` holds explicitly exported components (used for JSON/Markdown);
 * `allComponents` additionally includes glob-discovered components (used for
 * `.d.ts` generation). `resolveComponentFilePath` maps a component `source`
 * to its absolute path on disk.
 */
export interface CollectedComponents {
  exports: ParsedExports;
  allComponents: ParsedExports;
  rootDir: string;
  resolveComponentFilePath: ResolveComponentFilePath;
}

/** A `.svelte` file discovered on disk, before it's merged into `exports`/`allComponents`. */
export interface GlobbedComponentSource {
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
function findSvelteFiles(dir: string, results: string[] = [], visited = new Set<string>()): string[] {
  let entries: Dirent[];
  try {
    const real = realpathSync(dir);
    if (visited.has(real)) return results;
    visited.add(real);
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = join(dir, entry.name);
    const stat = entry.isSymbolicLink() ? statSync(entryPath, { throwIfNoEntry: false }) : entry;
    if (!stat) continue; // Broken symlink.

    if (stat.isDirectory()) {
      findSvelteFiles(entryPath, results, visited);
    } else if (stat.isFile() && entry.name.endsWith(".svelte")) {
      results.push(entryPath);
    }
  }

  return results;
}

/** Globs every `.svelte` file under `rootDir`, resolving each to its module name and source path. */
export function globComponentSources(rootDir: string): GlobbedComponentSource[] {
  return findSvelteFiles(rootDir).map((file) => {
    const moduleName = parse(file).name.replace(HYPHEN_REGEX, "");
    const source = asRelativeSourcePath(normalizeSeparators(`./${relative(rootDir, file)}`));
    return { moduleName, source };
  });
}

/**
 * Discovers component sources for an entry point without parsing them.
 *
 * Parses the entry's exports (when `input` is a file) and, when `glob` is set,
 * augments the set with every `.svelte` file under the entry directory.
 *
 * @param documentExports - When `true`, log and continue if the entry file fails
 *   the acorn component-export parse (TypeScript-only syntax is common).
 */
export function collectComponents(input: string, glob: boolean, documentExports = false): CollectedComponents {
  const isFile = lstatSync(input).isFile();
  const dir = isFile ? dirname(input) : input;
  const rootDir = resolve(dir);
  const resolveComponentFilePath: ResolveComponentFilePath = (filePath) =>
    isAbsolute(filePath) ? resolve(filePath) : resolve(rootDir, filePath);

  /**
   * Only parse exports if input is a file.
   * Directory inputs don't have a single entry point to parse exports from.
   */
  let exports: ParsedExports = {};
  if (isFile) {
    const entry = readFileSync(input, "utf-8");
    try {
      exports = parseExports(entry, rootDir, new Set([resolve(input)]));
    } catch (error) {
      // Without documentExports, throw. With it, warn and continue.
      if (!documentExports) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Failed to parse component exports from ${input}: ${message}`);
    }
  }

  const allComponents: ParsedExports = { ...exports };

  if (glob) {
    for (const { moduleName, source } of globComponentSources(rootDir)) {
      if (exports[moduleName]) {
        exports[moduleName].source = source;
      }

      if (allComponents[moduleName]) {
        allComponents[moduleName].source = source;
      } else {
        allComponents[moduleName] = { source, default: false };
      }
    }
  }

  return { exports, allComponents, rootDir, resolveComponentFilePath };
}

/**
 * Reads the given component file paths into a map of path -> contents.
 *
 * Failed reads are recorded as `null` (and logged) so callers can skip them
 * gracefully rather than aborting the whole bundle.
 */
export async function readFileMap(filePaths: Iterable<string>): Promise<Map<string, string | null>> {
  const fileContents = await Promise.all(
    Array.from(filePaths).map(async (filePath) => {
      try {
        const content = await readFile(filePath, "utf-8");
        return { path: filePath, content };
      } catch (error) {
        console.warn(`Warning: Failed to read file ${filePath}:`, error);
        return { path: filePath, content: null };
      }
    }),
  );

  return new Map<string, string | null>(fileContents.map(({ path, content }) => [path, content]));
}

/**
 * Parses a single component entry into its documentation API.
 *
 * Reads the component contents from `fileMap` and parses it to extract
 * component metadata (a top-level `<style>` block, if present, is masked out
 * of the text scanned for JSDoc comments inside `ComponentParser`, without a
 * separate parse). Returns `null` for non-Svelte entries or files that could
 * not be read.
 *
 * A component that throws while parsing is captured via `options.onParseError`
 * (and `null` is returned) so callers can continue with the rest, unless
 * `options.failFast` is set, in which case the error is rethrown.
 *
 * @param entry - Export entry tuple `[exportName, exportInfo]`
 * @param entries - All sibling entries, used to resolve the module name
 * @param fileMap - Map of resolved file paths to their contents
 * @param resolveComponentFilePath - Resolves a component `source` to its absolute path
 * @param options - Parse-failure handling (`failFast` / `onParseError`)
 */
export function processComponent(
  [exportName, entry]: [string, ParsedExports[string]],
  entries: Array<[string, ParsedExports[string]]>,
  fileMap: Map<string, string | null>,
  resolveComponentFilePath: ResolveComponentFilePath,
  options: ProcessComponentOptions = {},
): ComponentDocApi | null {
  const filePath = entry.source;
  const { ext, name } = parse(filePath);

  let moduleName = exportName;

  if (entries.length === 1 && exportName === "default") {
    moduleName = name;
  }

  if (ext === ".svelte") {
    const resolvedPath = resolveComponentFilePath(filePath);
    const source = fileMap.get(resolvedPath);

    if (source === null || source === undefined) {
      /**
       * File was not found or failed to read, skip this component.
       * This can happen if the file doesn't exist or if there was an error
       * reading it (already logged as a warning).
       */
      return null;
    }

    const normalizedFilePath = normalizeSeparators(filePath);

    const memoized = options.memo?.get(resolvedPath);
    const hash = options.hashes?.get(resolvedPath);
    const cached = memoized === undefined ? (hash === undefined ? null : options.cache?.get(resolvedPath, hash)) : null;

    let parsed: ParsedComponent;
    if (memoized !== undefined) {
      parsed = memoized;
    } else if (cached) {
      parsed = cached;
    } else {
      const parser = new (getParserStack().ComponentParser)();
      try {
        parsed = parser.parseSvelteComponent(source, {
          moduleName,
          filePath: normalizedFilePath,
        });
      } catch (error) {
        /**
         * Capture the failure as a diagnostic so the remaining components can
         * still be processed. When `failFast` is enabled we rethrow to restore
         * the abort-on-first-error behavior.
         */
        if (options.failFast) {
          throw error;
        }

        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        options.onParseError?.({
          filePath: normalizedFilePath,
          moduleName,
          message,
          stack,
        });
        return null;
      }

      if (hash !== undefined) {
        options.cache?.set(resolvedPath, hash, parsed);
      }
      // Memoize fresh parses only; disk-cache hits may be invalidated later in the same run.
      options.memo?.set(resolvedPath, parsed);
    }

    return {
      moduleName,
      filePath: normalizedFilePath,
      ...parsed,
    };
  }

  return null;
}

export function collectSvelteFilePaths(
  entriesList: Array<Array<[string, ParsedExports[string]]>>,
  resolveComponentFilePath: ResolveComponentFilePath,
): Set<string> {
  const uniqueFilePaths = new Set<string>();
  for (const entries of entriesList) {
    for (const [, entry] of entries) {
      if (parse(entry.source).ext === ".svelte") {
        uniqueFilePaths.add(resolveComponentFilePath(entry.source));
      }
    }
  }
  return uniqueFilePaths;
}

export function reportParseErrors(errors: ComponentParseError[]): void {
  if (errors.length === 0) return;
  console.error(`sveld: failed to parse ${errors.length} component(s):`);
  for (const { filePath, message } of errors) {
    console.error(`  - ${filePath}: ${message}`);
  }
}

/**
 * Generates component documentation bundle from Svelte source files.
 *
 * Parses exports, discovers components (optionally via glob), and processes
 * all Svelte files to extract component metadata. Returns both exported
 * components (for JSON/Markdown) and all components (for TypeScript definitions).
 *
 * A single component that fails to parse is captured as a diagnostic (see
 * {@link GenerateBundleResult.errors}) so the remaining components still emit
 * output. Pass `{ failFast: true }` to restore abort-on-first-error behavior.
 *
 * @param input - Entry point file or directory containing Svelte components
 * @param glob - Whether to glob for all .svelte files in the directory
 * @param options - Bundle options (e.g. `failFast`, `resolveTypes`, `documentExports`)
 * @returns Bundle result containing exports, entryExports, components, allComponentsForTypes, and errors
 *
 * @example
 * ```ts
 * // Generate from single file:
 * const result = await generateBundle("./src/App.svelte", false);
 *
 * // Generate from directory with glob:
 * const result = await generateBundle("./src", true);
 *
 * // Abort on the first parse failure:
 * const result = await generateBundle("./src", true, { failFast: true });
 * ```
 */
export async function generateBundle(
  input: string,
  glob: boolean,
  options: GenerateBundleOptions = {},
): Promise<GenerateBundleResult> {
  const documentExports = options.documentExports === true;
  const { exports, allComponents, rootDir, resolveComponentFilePath } = collectComponents(input, glob, documentExports);

  // File entry only; directory inputs have no barrel.
  const entryExports: EntryExports =
    documentExports && lstatSync(input).isFile() ? await parseEntryExports(resolve(input)) : [];

  const exportEntries = Object.entries(exports);
  const allComponentEntries = Object.entries(allComponents);

  const uniqueFilePaths = collectSvelteFilePaths([exportEntries, allComponentEntries], resolveComponentFilePath);
  const fileMap = await readFileMap(uniqueFilePaths);

  const components: ComponentDocs = new Map();
  const allComponentsForTypes: ComponentDocs = new Map();

  // `cache` is on by default; only an explicit `false` disables it.
  const cache =
    options.cache === false ? undefined : new ParseCache(resolveCacheFilePath(rootDir, options.cache ?? true));

  const misses = new Set<string>();
  const hashes = new Map<string, string>();
  if (cache) {
    for (const filePath of uniqueFilePaths) {
      const source = fileMap.get(filePath);
      if (source === null || source === undefined) continue;
      const hash = hashSource(source);
      hashes.set(filePath, hash);
      if (!cache.has(filePath, hash)) {
        misses.add(filePath);
      }
    }
  }

  // Without a cache every component is parsed fresh; with one, only load the
  // parser stack when at least one component actually needs (re)parsing, so
  // a fully cached run skips it entirely.
  if (uniqueFilePaths.size > 0 && (!cache || misses.size > 0)) {
    await loadParserStack();
  }

  /**
   * Dedupe by file path: the same component is parsed once for the exported
   * set and once for the all-components set, via the in-run memo below.
   */
  const parseErrors = new Map<string, ComponentParseError>();
  const memo = new Map<string, ParsedComponent>();
  const processOptions: ProcessComponentOptions = {
    failFast: options.failFast === true,
    onParseError: (error) => parseErrors.set(error.filePath, error),
    cache,
    hashes,
    memo,
  };

  /**
   * Process exported components (for metadata/JSON/Markdown).
   * Only components that are explicitly exported are included in the
   * components map for JSON and Markdown output.
   */
  for (const entry of exportEntries) {
    const result = processComponent(entry, exportEntries, fileMap, resolveComponentFilePath, processOptions);
    if (result) components.set(result.moduleName, result);
  }

  /**
   * Process all components (for .d.ts generation).
   * All discovered components are included in allComponentsForTypes
   * to ensure TypeScript definitions are generated for all components,
   * even if they're not explicitly exported.
   */
  for (const entry of allComponentEntries) {
    const result = processComponent(entry, allComponentEntries, fileMap, resolveComponentFilePath, processOptions);
    if (result) allComponentsForTypes.set(result.moduleName, result);
  }

  if (cache && misses.size > 0) {
    // Reparse unchanged files that extend something that changed.
    const reverseDeps = buildReverseDeps(allComponentsForTypes, resolveComponentFilePath);
    const affected = expandAffected(misses, reverseDeps);

    for (const filePath of affected) {
      if (misses.has(filePath)) continue;
      cache.invalidate(filePath);
      memo.delete(filePath);
    }

    for (const entry of exportEntries) {
      const resolvedPath = resolveComponentFilePath(entry[1].source);
      if (!affected.has(resolvedPath) || misses.has(resolvedPath)) continue;
      const result = processComponent(entry, exportEntries, fileMap, resolveComponentFilePath, processOptions);
      if (result) components.set(result.moduleName, result);
    }
    for (const entry of allComponentEntries) {
      const resolvedPath = resolveComponentFilePath(entry[1].source);
      if (!affected.has(resolvedPath) || misses.has(resolvedPath)) continue;
      const result = processComponent(entry, allComponentEntries, fileMap, resolveComponentFilePath, processOptions);
      if (result) allComponentsForTypes.set(result.moduleName, result);
    }
  }

  const errors = Array.from(parseErrors.values());
  reportParseErrors(errors);

  // Dry runs must not persist cache state from a run that wrote nothing else.
  if (!options.dryRun) cache?.save();

  // checkExamples runs over all discovered components, not just barrel exports.
  const resolveTypesCandidates = options.resolveTypes ? collectResolveTypesCandidates(components) : [];
  const checkExamplesCandidates = options.checkExamples ? collectCheckExamplesCandidates(allComponentsForTypes) : [];

  if (resolveTypesCandidates.length > 0 || checkExamplesCandidates.length > 0) {
    // Share one TypeResolver when both resolveTypes and checkExamples are enabled.
    const { TypeResolver } = await import("./resolve-types");
    const resolver = await TypeResolver.create(rootDir);

    try {
      if (resolveTypesCandidates.length > 0) {
        await resolveImportedPropTypes(resolveTypesCandidates, resolver, resolveComponentFilePath);
      }
      if (checkExamplesCandidates.length > 0) {
        await checkComponentExamples(checkExamplesCandidates, resolver, resolveComponentFilePath);
      }
    } finally {
      await resolver?.dispose();
    }
  }

  // Dedupe diagnostics from export and all-components passes.
  const diagnostics = dedupeDiagnostics(
    Array.from(allComponentsForTypes.values()).flatMap((component) => component.diagnostics ?? []),
  );

  return {
    exports,
    entryExports,
    components,
    allComponentsForTypes,
    errors,
    diagnostics,
  };
}

interface ResolveTypesCandidate {
  component: ComponentDocApi;
  metadata: NonNullable<ReturnType<typeof getParsedComponentTypeScriptMetadata>>;
}

function collectResolveTypesCandidates(components: ComponentDocs): ResolveTypesCandidate[] {
  const candidates: ResolveTypesCandidate[] = [];

  for (const component of components.values()) {
    const metadata = getParsedComponentTypeScriptMetadata(component);
    if (!metadata?.canonicalPropsType || component.props.length > 0) continue;
    candidates.push({ component, metadata });
  }

  return candidates;
}

async function resolveImportedPropTypes(
  candidates: ResolveTypesCandidate[],
  resolver: TypeResolver | null,
  resolveComponentFilePath: ResolveComponentFilePath,
): Promise<void> {
  if (!resolver) return;

  const resolvedByModule = await resolver.expandAll(
    candidates.map(({ component, metadata }) => ({
      moduleName: component.moduleName,
      metadata,
      filePath: resolveComponentFilePath(component.filePath),
    })),
  );

  for (const { component } of candidates) {
    const resolved = resolvedByModule.get(component.moduleName);
    if (resolved) applyResolvedProps(component, resolved);
  }
}

interface CheckExamplesCandidate {
  component: ComponentDocApi;
  sources: ReturnType<typeof collectExampleSources>;
}

function collectCheckExamplesCandidates(components: ComponentDocs): CheckExamplesCandidate[] {
  const candidates: CheckExamplesCandidate[] = [];

  for (const component of components.values()) {
    const sources = collectExampleSources(component);
    if (sources.length === 0) continue;
    candidates.push({ component, sources });
  }

  return candidates;
}

async function checkComponentExamples(
  candidates: CheckExamplesCandidate[],
  resolver: TypeResolver | null,
  resolveComponentFilePath: ResolveComponentFilePath,
): Promise<void> {
  if (!resolver) return;

  const diagnosticsByModule = await resolver.checkExamples(
    candidates.map(({ component, sources }) => ({
      moduleName: component.moduleName,
      filePath: resolveComponentFilePath(component.filePath),
      sources,
    })),
  );

  for (const { component, sources } of candidates) {
    const found = diagnosticsByModule.get(component.moduleName);
    if (!found || found.length === 0) continue;

    const sourceById = new Map(sources.map((source) => [source.id, source.source]));

    const diagnostics = component.diagnostics ?? [];
    for (const item of found) {
      const source = sourceById.get(item.id);
      diagnostics.push({
        component: component.filePath,
        kind: "example-compile-error",
        name: item.name,
        message: item.message,
        ...(source ? { source } : {}),
      });
    }
    component.diagnostics = diagnostics;
  }
}
