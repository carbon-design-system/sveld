import type { NormalizedPath } from "./brands";
import type { DiagnosticIgnoreMatcher, SveldDiagnostic } from "./diagnostics";
import type { ParsedComponent } from "./model";
import type { ParseCache } from "./parse-cache";
import type { EntryExports } from "./parse-entry-exports";
import type { ParsedExports } from "./parse-exports";
import { Project } from "./project";

export interface ComponentDocApi extends ParsedComponent {
  filePath: NormalizedPath;
  moduleName: string;
}

export type ComponentDocs = Map<string, ComponentDocApi>;

/** A component parse failure, captured so the rest of the run can continue. */
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
   * @internal Undefined when caching is off. Exposed so the write phase can
   * layer a generated-text cache on top and `save()` again after writing.
   */
  cache?: ParseCache;
  /**
   * @internal filePath -> resolved source path (the `cache` entry key), so
   * the write phase skips path-alias resolution. Keyed by filePath since
   * moduleName isn't unique. Undefined when caching is off. Omits components
   * resolved from another file's contents; see `crossFileResolvedPathByFilePath`.
   */
  resolvedPathByFilePath?: Map<string, string>;
  /**
   * @internal The components `resolvedPathByFilePath` omits: their cached
   * text is also keyed on their resolved content, since their own source
   * doesn't determine it.
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
   * Svelte/HTML examples through sveld's template parser (sveast)
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

export function toGenerateBundleOptions(opts?: GenerateBundleOptions): GenerateBundleOptions {
  return {
    failFast: opts?.failFast,
    documentExports: opts?.documentExports === true,
    cache: opts?.cache,
    checkExamples: opts?.checkExamples === "syntax" ? "syntax" : opts?.checkExamples === true,
    diagnostics: opts?.diagnostics,
  };
}

/** Resolves a (possibly relative) component path to an absolute path. */
export type ResolveComponentFilePath = (filePath: string) => string;

/**
 * Parses the entry's exported components (for JSON/Markdown) and, with
 * `glob`, every `.svelte` file beside it (for TypeScript definitions). A
 * component that fails to parse lands in `errors` unless `failFast` is set.
 */
export async function generateBundle(
  input: string,
  glob: boolean,
  options: GenerateBundleOptions = {},
): Promise<GenerateBundleResult> {
  return new Project(input, glob, options).build();
}
