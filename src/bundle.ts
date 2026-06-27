import { lstatSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, parse, relative, resolve } from "node:path";
import { parse as parseSvelte } from "svelte/compiler";
import { globSync } from "tinyglobby";
import { asRelativeSourcePath, type NormalizedPath } from "./brands";
import ComponentParser, { type ParsedComponent } from "./ComponentParser";
import { type ParsedExports, parseExports } from "./parse-exports";
import { normalizeSeparators } from "./path";

export interface ComponentDocApi extends ParsedComponent {
  filePath: NormalizedPath;
  moduleName: string;
}

export type ComponentDocs = Map<string, ComponentDocApi>;

export interface GenerateBundleResult {
  exports: ParsedExports;
  components: ComponentDocs;
  allComponentsForTypes: ComponentDocs;
}

/** A function that resolves a (possibly relative) component path to an absolute path. */
export type ResolveComponentFilePath = (filePath: string) => string;

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
 */
export function collectComponents(input: string, glob: boolean): CollectedComponents {
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
    exports = parseExports(entry, rootDir);
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
 * @param entry - Export entry tuple `[exportName, exportInfo]`
 * @param entries - All sibling entries, used to resolve the module name
 * @param fileMap - Map of resolved file paths to their contents
 * @param resolveComponentFilePath - Resolves a component `source` to its absolute path
 */
export function processComponent(
  [exportName, entry]: [string, ParsedExports[string]],
  entries: Array<[string, ParsedExports[string]]>,
  fileMap: Map<string, string | null>,
  resolveComponentFilePath: ResolveComponentFilePath,
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

    const parser = new ComponentParser();
    const parsed = parser.parseSvelteComponent(stripTopLevelStyleBlock(source), {
      moduleName,
      filePath: normalizeSeparators(filePath),
    });

    return {
      moduleName,
      filePath: normalizeSeparators(filePath),
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

/**
 * Generates component documentation bundle from Svelte source files.
 *
 * Parses exports, discovers components (optionally via glob), and processes
 * all Svelte files to extract component metadata. Returns both exported
 * components (for JSON/Markdown) and all components (for TypeScript definitions).
 *
 * @param input - Entry point file or directory containing Svelte components
 * @param glob - Whether to glob for all .svelte files in the directory
 * @returns Bundle result containing exports, components, and allComponentsForTypes
 *
 * @example
 * ```ts
 * // Generate from single file:
 * const result = await generateBundle("./src/App.svelte", false);
 *
 * // Generate from directory with glob:
 * const result = await generateBundle("./src", true);
 * ```
 */
export async function generateBundle(input: string, glob: boolean): Promise<GenerateBundleResult> {
  const { exports, allComponents, resolveComponentFilePath } = collectComponents(input, glob);

  const exportEntries = Object.entries(exports);
  const allComponentEntries = Object.entries(allComponents);

  const uniqueFilePaths = collectSvelteFilePaths([exportEntries, allComponentEntries], resolveComponentFilePath);
  const fileMap = await readFileMap(uniqueFilePaths);

  const components: ComponentDocs = new Map();
  const allComponentsForTypes: ComponentDocs = new Map();

  /**
   * Process exported components (for metadata/JSON/Markdown).
   * Only components that are explicitly exported are included in the
   * components map for JSON and Markdown output.
   */
  for (const entry of exportEntries) {
    const result = processComponent(entry, exportEntries, fileMap, resolveComponentFilePath);
    if (result) components.set(result.moduleName, result);
  }

  /**
   * Process all components (for .d.ts generation).
   * All discovered components are included in allComponentsForTypes
   * to ensure TypeScript definitions are generated for all components,
   * even if they're not explicitly exported.
   */
  for (const entry of allComponentEntries) {
    const result = processComponent(entry, allComponentEntries, fileMap, resolveComponentFilePath);
    if (result) allComponentsForTypes.set(result.moduleName, result);
  }

  return {
    exports,
    components,
    allComponentsForTypes,
  };
}
