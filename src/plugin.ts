import { lstatSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, parse, relative, resolve } from "node:path";
import { parse as parseSvelte } from "svelte/compiler";
import { globSync } from "tinyglobby";
import { asRelativeSourcePath, type NormalizedPath } from "./brands";
import ComponentParser, { type ParsedComponent } from "./ComponentParser";
import { getSvelteEntry } from "./get-svelte-entry";
import { type ParsedExports, parseExports } from "./parse-exports";
import { normalizeSeparators } from "./path";
import writeJson, { type WriteJsonOptions } from "./writer/writer-json";
import writeMarkdown, { type WriteMarkdownOptions } from "./writer/writer-markdown";
import writeTsDefinitions, { type WriteTsDefinitionsOptions } from "./writer/writer-ts-definitions";

export interface PluginSveldOptions {
  /**
   * Specify the entry point to uncompiled Svelte source.
   * If not provided, sveld will use the "svelte" field from package.json.
   */
  entry?: string;
  glob?: boolean;
  types?: boolean;
  typesOptions?: Partial<Omit<WriteTsDefinitionsOptions, "inputDir">>;
  json?: boolean;
  jsonOptions?: Partial<Omit<WriteJsonOptions, "inputDir">>;
  markdown?: boolean;
  markdownOptions?: Partial<WriteMarkdownOptions>;
  /**
   * Abort the entire run when a single component fails to parse.
   * When `false` (the default), parse failures are collected as diagnostics
   * and the remaining components still emit their output.
   */
  failFast?: boolean;
}

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

interface SveldPlugin {
  name: string;
  apply?: "build" | "serve";
  enforce?: "pre" | "post";
  buildStart(): void;
  generateBundle(): Promise<void>;
  writeBundle(): void;
}

export default function pluginSveld(opts?: PluginSveldOptions): SveldPlugin {
  let result: GenerateBundleResult;
  let input: string | null;

  return {
    name: "vite-plugin-sveld",
    apply: "build",
    enforce: "post",
    buildStart() {
      input = getSvelteEntry(opts?.entry);
    },
    async generateBundle() {
      if (input != null) {
        result = await generateBundle(input, opts?.glob === true, { failFast: opts?.failFast });
      }
    },
    writeBundle() {
      if (input != null) writeOutput(result, opts || {}, input);
    },
  };
}

interface GenerateBundleResult {
  exports: ParsedExports;
  components: ComponentDocs;
  allComponentsForTypes: ComponentDocs;
  /**
   * Components that failed to parse. Empty unless `failFast` is disabled and
   * one or more components threw during parsing.
   */
  errors: ComponentParseError[];
}

export interface GenerateBundleOptions {
  /**
   * Throw on the first component that fails to parse instead of collecting
   * the failure and continuing with the remaining components.
   */
  failFast?: boolean;
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
 * @param options - Bundle options (e.g. `failFast`)
 * @returns Bundle result containing exports, components, allComponentsForTypes, and errors
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
export async function generateBundle(input: string, glob: boolean, options: GenerateBundleOptions = {}) {
  const failFast = options.failFast === true;
  const parseErrors = new Map<string, ComponentParseError>();
  const isFile = lstatSync(input).isFile();
  const dir = isFile ? dirname(input) : input;
  const rootDir = resolve(dir);
  const resolveComponentFilePath = (filePath: string) =>
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

  const components: ComponentDocs = new Map();
  const allComponentsForTypes: ComponentDocs = new Map();
  const exportEntries = Object.entries(exports);
  const allComponentEntries = Object.entries(allComponents);

  const uniqueFilePaths = new Set<string>();
  for (const [, entry] of exportEntries) {
    const filePath = entry.source;
    const { ext } = parse(filePath);
    if (ext === ".svelte") {
      uniqueFilePaths.add(resolveComponentFilePath(filePath));
    }
  }
  for (const [, entry] of allComponentEntries) {
    const filePath = entry.source;
    const { ext } = parse(filePath);
    if (ext === ".svelte") {
      uniqueFilePaths.add(resolveComponentFilePath(filePath));
    }
  }

  const fileContents = await Promise.all(
    Array.from(uniqueFilePaths).map(async (filePath) => {
      try {
        const content = await readFile(filePath, "utf-8");
        return { path: filePath, content };
      } catch (error) {
        console.warn(`Warning: Failed to read file ${filePath}:`, error);
        return { path: filePath, content: null };
      }
    }),
  );

  const fileMap = new Map<string, string | null>(fileContents.map(({ path, content }) => [path, content]));

  /**
   * Helper function to process a single component.
   *
   * Reads the component file, removes top-level styles for metadata parsing,
   * and parses it to extract component metadata. Handles file read errors gracefully.
   *
   * @param entry - Export entry tuple [exportName, exportInfo]
   * @param entries - All export entries for context
   * @param fileMap - Map of file paths to their contents
   * @returns Component documentation or null if processing failed
   *
   * @example
   * ```ts
   * const result = await processComponent(
   *   ["Button", { source: "./Button.svelte", default: true }],
   *   allEntries,
   *   fileMap
   * );
   * // Returns: { moduleName: "Button", filePath: "./Button.svelte", props: [...], ... }
   * ```
   */
  const processComponent = async (
    [exportName, entry]: [string, ParsedExports[string]],
    entries: Array<[string, ParsedExports[string]]>,
    fileMap: Map<string, string | null>,
  ) => {
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
      const parser = new ComponentParser();

      let parsed: ParsedComponent;
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
        if (failFast) {
          throw error;
        }

        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        /**
         * Dedupe by file path: the same component is parsed once for the
         * exported set and once for the all-components set.
         */
        parseErrors.set(normalizedFilePath, { filePath: normalizedFilePath, moduleName, message, stack });
        return null;
      }

      return {
        moduleName,
        filePath: normalizedFilePath,
        ...parsed,
      };
    }

    return null;
  };

  /**
   * Process exported components (for metadata/JSON/Markdown).
   * Only components that are explicitly exported are included in the
   * components map for JSON and Markdown output.
   */
  const componentPromises = exportEntries.map((entry) => processComponent(entry, exportEntries, fileMap));

  /**
   * Process all components (for .d.ts generation).
   * All discovered components are included in allComponentsForTypes
   * to ensure TypeScript definitions are generated for all components,
   * even if they're not explicitly exported.
   */
  const allComponentPromises = allComponentEntries.map((entry) =>
    processComponent(entry, allComponentEntries, fileMap),
  );

  const [results, allResults] = await Promise.all([Promise.all(componentPromises), Promise.all(allComponentPromises)]);

  for (const result of results) {
    if (result) {
      components.set(result.moduleName, result);
    }
  }

  for (const result of allResults) {
    if (result) {
      allComponentsForTypes.set(result.moduleName, result);
    }
  }

  const errors = Array.from(parseErrors.values());

  if (errors.length > 0) {
    console.error(`sveld: failed to parse ${errors.length} component(s):`);
    for (const { filePath, message } of errors) {
      console.error(`  - ${filePath}: ${message}`);
    }
  }

  return {
    exports,
    components,
    allComponentsForTypes,
    errors,
  };
}

/**
 * Writes output files based on plugin options.
 *
 * Generates TypeScript definitions, JSON metadata, and/or Markdown documentation
 * based on the options provided. Uses different component sets for different
 * output types to match expected behavior.
 *
 * @param result - Bundle result containing exports and component documentation
 * @param opts - Plugin options determining what outputs to generate
 * @param input - Input file path for determining input directory
 *
 * @example
 * ```ts
 * writeOutput(result, {
 *   types: true,
 *   json: true,
 *   markdown: true
 * }, "./src/App.svelte");
 * // Generates: types/*.d.ts, COMPONENT_API.json, COMPONENT_INDEX.md
 * ```
 */
export function writeOutput(result: GenerateBundleResult, opts: PluginSveldOptions, input: string) {
  const inputDir = dirname(input);

  if (opts?.types !== false) {
    /**
     * Use allComponentsForTypes to generate .d.ts for all discovered components.
     * This ensures TypeScript definitions are available for all components,
     * not just exported ones, which is useful for type checking.
     */
    writeTsDefinitions(result.allComponentsForTypes, {
      outDir: "types",
      preamble: "",
      ...opts?.typesOptions,
      exports: result.exports,
      inputDir,
    });
  }

  if (opts?.json) {
    /**
     * Use components (exported only) for JSON metadata.
     * JSON output should only include components that are actually exported,
     * matching the public API surface.
     */
    writeJson(result.components, {
      outFile: "COMPONENT_API.json",
      ...opts?.jsonOptions,
      input,
      inputDir,
    });
  }

  if (opts?.markdown) {
    /**
     * Use components (exported only) for Markdown documentation.
     * Documentation should only include exported components that are
     * part of the public API.
     */
    writeMarkdown(result.components, {
      outFile: "COMPONENT_INDEX.md",
      ...opts?.markdownOptions,
    });
  }
}
