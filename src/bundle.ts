import type { NormalizedPath } from "./brands";
import type { ParsedComponent } from "./ComponentParser";
import type { DiagnosticIgnoreMatcher, SveldDiagnostic } from "./diagnostics";
import type { ParseCache } from "./parse-cache";
import type { EntryExports } from "./parse-entry-exports";
import type { ParsedExports } from "./parse-exports";
import { Project } from "./project";

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
  /** Keyed by `moduleName`, unique here because it comes from the entry barrel's export names. */
  components: ComponentDocs;
  /**
   * Every `--glob`-discovered `.svelte` file, keyed by resolved `filePath`
   * rather than `moduleName`: two files in different directories can share a
   * basename, so `moduleName` is not unique in this map. Derive output
   * locations from `filePath`, or check for a `moduleName` collision first.
   */
  allComponentsForTypes: ComponentDocs;
  /**
   * Components that failed to parse. Empty unless `failFast` is disabled and
   * one or more components threw during parsing.
   */
  errors: ComponentParseError[];
  /** Unknown props, `any` contexts, and orphan `@event` tags across the bundle. */
  diagnostics: SveldDiagnostic[];
  /**
   * @internal The parse cache instance for this run (undefined when the parse
   * cache is disabled). Exposed so the write phase can layer a generated-text
   * cache on top of it (see `writeTsDefinitions`) and persist the addition
   * with a second `save()` after writing.
   */
  cache?: ParseCache;
  /**
   * @internal filePath -> resolved source path, matching `cache` entry
   * identity so the write phase can look up text cache without redoing
   * path-alias resolution. Uses filePath because moduleName is not unique
   * when two components share a basename. Undefined when the parse cache
   * is disabled. Leaves out components whose output was resolved from
   * another file's contents; see `crossFileResolvedPathByFilePath`.
   */
  resolvedPathByFilePath?: Map<string, string>;
  /**
   * @internal Like `resolvedPathByFilePath`, for the components it leaves
   * out: their cached text is also keyed on their resolved content, since
   * their own source doesn't determine it.
   */
  crossFileResolvedPathByFilePath?: Map<string, string>;
}

export interface GenerateBundleOptions {
  /**
   * Throw on the first component that fails to parse instead of collecting
   * the failure and continuing with the remaining components.
   */
  failFast?: boolean;
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
   * Check `@example` blocks on props, module exports, slots, and events.
   * `true` runs plain TS/JS examples through the TypeScript program
   * (`example-compile-error` diagnostics; requires `typescript`) and
   * Svelte/HTML examples through sveld's own template parser
   * (`example-syntax-error` diagnostics; no `typescript` needed). Pass
   * `"syntax"` to run only the markup path, so `typescript` is never loaded
   * even when TS/JS examples exist. Off by default.
   */
  checkExamples?: boolean | "syntax";
  /**
   * `ignore`: diagnostics matching at least one `{ code?, component?, name? }`
   * matcher are marked `ignored` (an omitted field matches anything;
   * `component` is a glob). Ignored diagnostics still appear in
   * `SveldResult.diagnostics` and are counted in the text summary, but never
   * fail `--strict` / `--strict=errors`.
   */
  diagnostics?: { ignore?: DiagnosticIgnoreMatcher[] };
}

export function toGenerateBundleOptions(
  opts?: Pick<GenerateBundleOptions, "failFast" | "documentExports" | "cache" | "checkExamples" | "diagnostics">,
): GenerateBundleOptions {
  return {
    failFast: opts?.failFast,
    documentExports: opts?.documentExports === true,
    cache: opts?.cache,
    checkExamples: opts?.checkExamples === "syntax" ? "syntax" : opts?.checkExamples === true,
    diagnostics: opts?.diagnostics,
  };
}

/** A function that resolves a (possibly relative) component path to an absolute path. */
export type ResolveComponentFilePath = (filePath: string) => string;

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
 * @param options - Bundle options (e.g. `failFast`, `checkExamples`, `documentExports`)
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
  return new Project(input, glob, options).build();
}
