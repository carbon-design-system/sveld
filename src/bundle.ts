import { lstatSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, parse, relative, resolve } from "node:path";
import { parse as parseSvelte } from "svelte/compiler";
import { globSync } from "tinyglobby";
import { asRelativeSourcePath, type NormalizedPath } from "./brands";
import ComponentParser, {
  applyResolvedProps,
  getParsedComponentTypeScriptMetadata,
  type ParsedComponent,
} from "./ComponentParser";
import { buildReverseDeps, expandAffected } from "./dependency-graph";
import { dedupeDiagnostics, type SveldDiagnostic } from "./diagnostics";
import { hashSource, ParseCache, resolveCacheFilePath } from "./parse-cache";
import { type EntryExports, parseEntryExports } from "./parse-entry-exports";
import { type ParsedExports, parseExports } from "./parse-exports";
import { normalizeSeparators } from "./path";

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
   * later runs. `true` uses `node_modules/.cache/sveld/parse-cache.json`; a
   * string sets a custom path. Off by default.
   */
  cache?: boolean | string;
}

export function toGenerateBundleOptions(
  opts?: Pick<GenerateBundleOptions, "failFast" | "resolveTypes" | "documentExports" | "cache">,
): GenerateBundleOptions {
  return {
    failFast: opts?.failFast,
    resolveTypes: opts?.resolveTypes === true,
    documentExports: opts?.documentExports === true,
    cache: opts?.cache,
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
}

const STYLE_TAG_REGEX = /<style.+?<\/style>/gims;
const HYPHEN_REGEX = /-/g;

function stripTopLevelStyleBlock(source: string) {
  try {
    const parsed = parseSvelte(source, { modern: false }) as { css?: { start?: number; end?: number } };
    const start = parsed.css?.start;
    const end = parsed.css?.end;

    if (start === undefined || end === undefined) {
      return source;
    }

    return `${source.slice(0, start)}${source.slice(end)}`;
  } catch {
    // Fall back to the previous regex behavior if the source cannot be parsed.
    return source.replace(STYLE_TAG_REGEX, "");
  }
}

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
      exports = parseExports(entry, rootDir);
    } catch (error) {
      // Without documentExports, throw. With it, warn and continue.
      if (!documentExports) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Failed to parse component exports from ${input}: ${message}`);
    }
  }

  const allComponents: ParsedExports = { ...exports };

  if (glob) {
    for (const matchedFile of globSync(["**/*.svelte"], { cwd: rootDir, absolute: true })) {
      const file = resolve(matchedFile);
      const moduleName = parse(file).name.replace(HYPHEN_REGEX, "");
      const source = asRelativeSourcePath(normalizeSeparators(`./${relative(rootDir, file)}`));

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
 * Reads the component contents from `fileMap`, removes top-level styles for
 * metadata parsing, and parses it to extract component metadata. Returns `null`
 * for non-Svelte entries or files that could not be read.
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

    const hash = options.cache ? hashSource(source) : undefined;
    const cached = hash === undefined ? null : options.cache?.get(resolvedPath, hash);

    let parsed: ParsedComponent;
    if (cached) {
      parsed = cached;
    } else {
      const parser = new ComponentParser();
      try {
        parsed = parser.parseSvelteComponent(stripTopLevelStyleBlock(source), {
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
        options.onParseError?.({ filePath: normalizedFilePath, moduleName, message, stack });
        return null;
      }

      if (hash !== undefined) {
        options.cache?.set(resolvedPath, hash, parsed);
      }
    }

    return {
      moduleName,
      filePath: normalizedFilePath,
      ...parsed,
    };
  }

  return null;
}

/** Collects the resolved, absolute paths of all `.svelte` entries. */
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

/** Reports collected component parse errors to stderr. No-op when empty. */
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
    documentExports && lstatSync(input).isFile() ? parseEntryExports(resolve(input)) : [];

  const exportEntries = Object.entries(exports);
  const allComponentEntries = Object.entries(allComponents);

  const uniqueFilePaths = collectSvelteFilePaths([exportEntries, allComponentEntries], resolveComponentFilePath);
  const fileMap = await readFileMap(uniqueFilePaths);

  const components: ComponentDocs = new Map();
  const allComponentsForTypes: ComponentDocs = new Map();

  const cache = options.cache ? new ParseCache(resolveCacheFilePath(rootDir, options.cache)) : undefined;

  // Files that changed or were never cached. Used to invalidate @extends dependents.
  const misses = new Set<string>();
  if (cache) {
    for (const filePath of uniqueFilePaths) {
      const source = fileMap.get(filePath);
      if (source === null || source === undefined) continue;
      if (!cache.has(filePath, hashSource(source))) {
        misses.add(filePath);
      }
    }
  }

  /**
   * Dedupe by file path: the same component is parsed once for the exported
   * set and once for the all-components set.
   */
  const parseErrors = new Map<string, ComponentParseError>();
  const processOptions: ProcessComponentOptions = {
    failFast: options.failFast === true,
    onParseError: (error) => parseErrors.set(error.filePath, error),
    cache,
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

  if (options.resolveTypes) {
    await resolveImportedPropTypes(components, rootDir, resolveComponentFilePath);
  }

  cache?.save();

  // Same file can land in both export and all-components passes; dedupe before returning.
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

async function resolveImportedPropTypes(
  components: ComponentDocs,
  rootDir: string,
  resolveComponentFilePath: ResolveComponentFilePath,
): Promise<void> {
  const candidates: Array<{
    component: ComponentDocApi;
    metadata: NonNullable<ReturnType<typeof getParsedComponentTypeScriptMetadata>>;
  }> = [];

  for (const component of components.values()) {
    const metadata = getParsedComponentTypeScriptMetadata(component);
    if (!metadata?.canonicalPropsType || component.props.length > 0) continue;
    candidates.push({ component, metadata });
  }

  if (candidates.length === 0) return;

  const { TypeResolver } = await import("./resolve-types");
  const resolver = await TypeResolver.create(rootDir);
  if (!resolver) return;

  try {
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
  } finally {
    await resolver.dispose();
  }
}
