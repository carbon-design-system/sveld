import { dirname, isAbsolute, resolve } from "node:path";
import {
  type ComponentDocs,
  type GenerateBundleOptions,
  type GenerateBundleResult,
  generateBundle,
  toGenerateBundleOptions,
} from "./bundle";
import { getSvelteEntry } from "./get-svelte-entry";
import { loadConfig, loadConfigFrom, mergeConfig, validateOptions } from "./load-config";
import { setQuiet } from "./logger";
import { WATCH_RELEVANT_EXT_REGEX } from "./path";
import { createSveldBundle, type SveldBundle } from "./watch";
// Side-effect import: registers the built-in "json"/"markdown"/"types"/"custom-elements" writers.
import "./writer/built-in-writers";
import { getWriter } from "./writer/registry";
import { renderCustomElementsManifest, type WriteCustomElementsOptions } from "./writer/writer-custom-elements";
import { renderJsonDocument, renderJsonLines, type WriteJsonOptions } from "./writer/writer-json";
import type { WriteLlmsOptions } from "./writer/writer-llms";
import { renderMarkdownDocument, type WriteMarkdownOptions } from "./writer/writer-markdown";
import type { WriteMigrationReportOptions } from "./writer/writer-migration-report";
import type { WriteTsDefinitionsOptions } from "./writer/writer-ts-definitions";

export type { ComponentDocApi, ComponentDocs, GenerateBundleResult } from "./bundle";
export { generateBundle, toGenerateBundleOptions } from "./bundle";

export interface PluginSveldOptions
  extends Pick<GenerateBundleOptions, "resolveTypes" | "cache" | "checkExamples" | "diagnostics"> {
  /**
   * Specify the entry point to uncompiled Svelte source.
   * If not provided, sveld will use the "svelte" field from package.json.
   */
  entry?: string;
  /**
   * Load `sveld.config.{js,mjs,ts}` and merge it with these options; these
   * options win when a key is set in both. `true` resolves the config from
   * the Vite project root (or `process.cwd()` if the plugin isn't running
   * under Vite); a string is an explicit path to the config file itself.
   * @default false
   */
  config?: boolean | string;
  glob?: boolean;
  /** Suppress writer progress logs (`created "..."` / `unchanged "..."`). */
  quiet?: boolean;
  /** Record consts, functions, and types from the entry barrel. Off by default. */
  documentExports?: boolean;
  types?: boolean;
  typesOptions?: Partial<Omit<WriteTsDefinitionsOptions, "inputDir">>;
  json?: boolean;
  jsonOptions?: Partial<Omit<WriteJsonOptions, "inputDir">>;
  markdown?: boolean;
  markdownOptions?: Partial<WriteMarkdownOptions>;
  /** Generate a Custom Elements Manifest (`custom-elements.json`, schemaVersion "1.0.0"). */
  customElements?: boolean;
  customElementsOptions?: Partial<Omit<WriteCustomElementsOptions, "inputDir">>;
  /** Generate a first-party `llms.txt` / `llms-full.txt` pair (per https://llmstxt.org). */
  llms?: boolean;
  llmsOptions?: Partial<WriteLlmsOptions>;
  /**
   * Generate a Svelte 5 migration readiness report (`MIGRATION_REPORT.json` /
   * `MIGRATION_REPORT.md`): a per-component 0-100 heuristic score plus a
   * library-wide rollup. See the README's "Migration report" section.
   */
  migrationReport?: boolean;
  migrationReportOptions?: Partial<WriteMigrationReportOptions>;
  /**
   * Run additional, userland-registered writers (via `registerWriter` from
   * "sveld") beyond the built-in `json`/`markdown`/`types` outputs. Keyed by
   * the writer's registered `name`, valued by that writer's options.
   */
  additionalWriters?: Record<string, unknown>;
  /**
   * Abort the entire run when a single component fails to parse.
   * When `false` (the default), parse failures are collected as diagnostics
   * and the remaining components still emit their output.
   */
  failFast?: boolean;
  /**
   * Regenerate output incrementally when relevant source changes during
   * `vite dev` / `vite build --watch`: a component, the entry barrel itself
   * (adding/removing an export), or a non-`.svelte` file a component depends
   * on via `@extendProps` / `@extends` or a typedef `import("./x")`
   * reference. Only the affected components are re-parsed.
   * @default false
   */
  watch?: boolean;
}

/** Subset of Vite/Rollup's HMR context that the watch hook relies on. */
interface HotUpdateContext {
  file: string;
}

/** Subset of Rollup's plugin context that `generateBundle`/`writeBundle` rely on to fail the build. */
interface RollupPluginContext {
  error(message: string): never;
}

/** Subset of Vite's resolved config, used only to locate the project root for `config` loading. */
interface ResolvedViteConfig {
  root: string;
}

interface SveldPlugin {
  name: string;
  apply?: "build" | "serve";
  enforce?: "pre" | "post";
  /** Vite-only hook: captures the project root before `buildStart` runs. */
  configResolved?(config: ResolvedViteConfig): void;
  buildStart(): void | Promise<void>;
  generateBundle(this: RollupPluginContext): Promise<void>;
  writeBundle(this: RollupPluginContext): Promise<void>;
  /** Vite dev-server HMR hook (serve mode). */
  handleHotUpdate?(ctx: HotUpdateContext): void;
  /** Rollup/Vite watch hook (build `--watch`). */
  watchChange?(id: string): void;
}

/** Message emitted (via `this.error`) when the entry point cannot be resolved. Matches `sveld()`'s thrown message. */
const UNRESOLVED_ENTRY_MESSAGE =
  'sveld: could not resolve a Svelte entry point. Set package.json#svelte, or pass the "entry" option.';

/** Debounce window (ms) for coalescing rapid file changes into one regeneration. */
const WATCH_DEBOUNCE_MS = 50;

/**
 * Wraps an async `run` function so repeated calls execute strictly one after
 * another: a call that arrives while a previous one is still in flight
 * queues behind it instead of overlapping. Used to serialize watch-mode
 * flushes, which mutate a shared `SveldBundle`'s internal state and would
 * race if two ran concurrently.
 */
export function createSerialQueue(run: () => Promise<void>): () => void {
  let pending: Promise<void> = Promise.resolve();
  return () => {
    pending = pending.then(run, run);
  };
}

export default function pluginSveld(opts?: PluginSveldOptions): SveldPlugin {
  const watch = opts?.watch === true;
  let result: GenerateBundleResult;
  let input: string | null;
  // Reassigned once in `buildStart` when `config` loading is enabled; every
  // hook below reads options through this rather than `opts` directly so a
  // loaded config file is visible everywhere.
  let mergedOpts: PluginSveldOptions = opts ?? {};
  let root: string | undefined;

  // Watch-mode state: a long-lived bundle that supports scoped re-parsing.
  let bundle: SveldBundle | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Set<string>();

  const runFlush = async () => {
    if (bundle == null || input == null || pending.size === 0) return;
    const changed = Array.from(pending);
    pending.clear();
    try {
      const { result: next } = await bundle.update(changed);
      await writeOutput(next, mergedOpts, input);
    } catch (error) {
      console.error("sveld: failed to regenerate types in watch mode:", error);
    }
  };

  // Queues flushes onto one another so a slow `bundle.update()` can't
  // overlap with the next debounced flush and race on the bundle's shared state.
  const flush = createSerialQueue(runFlush);

  const scheduleUpdate = (id: string) => {
    if (!watch || bundle == null || !WATCH_RELEVANT_EXT_REGEX.test(id)) return;
    pending.add(id);
    clearTimeout(timer);
    timer = setTimeout(flush, WATCH_DEBOUNCE_MS);
  };

  return {
    name: "vite-plugin-sveld",
    // In watch mode the plugin must also run in `serve` (dev server), so leave
    // `apply` unset. Otherwise keep the original build-only behavior.
    apply: watch ? undefined : "build",
    enforce: "post",
    configResolved(config) {
      root = config.root;
    },
    async buildStart() {
      if (opts?.config) {
        const cwd = root ?? process.cwd();
        const fileConfig =
          typeof opts.config === "string"
            ? await loadConfigFrom(isAbsolute(opts.config) ? opts.config : resolve(cwd, opts.config))
            : await loadConfig(cwd);
        mergedOpts = mergeConfig<PluginSveldOptions>(fileConfig, opts);
      }
      validateOptions(mergedOpts);
      setQuiet(mergedOpts.quiet === true);
      input = getSvelteEntry(mergedOpts.entry);
      if (watch && input != null) {
        // Produce the initial output and prime the incremental bundle. This
        // covers both `vite dev` (where generateBundle/writeBundle never fire)
        // and `vite build --watch`.
        bundle = await createSveldBundle(input, mergedOpts.glob === true, mergedOpts.documentExports === true);
        await writeOutput(bundle.result, mergedOpts, input);
      }
    },
    async generateBundle() {
      // In watch mode the initial build happens in `buildStart`.
      if (watch) return;
      if (input == null) {
        this.error(UNRESOLVED_ENTRY_MESSAGE);
      }
      result = await generateBundle(input, mergedOpts.glob === true, toGenerateBundleOptions(mergedOpts));
    },
    async writeBundle() {
      if (watch) return;
      if (input == null) {
        this.error(UNRESOLVED_ENTRY_MESSAGE);
      }
      await writeOutput(result, mergedOpts, input);
      // Persists any generated `.d.ts` text writeOutput just cached, on top
      // of the parse-only save generateBundle() already did.
      result.cache?.save();
    },
    handleHotUpdate(ctx) {
      scheduleUpdate(ctx.file);
    },
    watchChange(id) {
      scheduleUpdate(id);
    },
  };
}

/** Looks up a built-in writer by name; throws if `built-in-writers` never registered it. */
function runBuiltInWriter(
  name: "types" | "json" | "markdown" | "custom-elements" | "llms" | "migration-report",
  components: ComponentDocs,
  options: unknown,
) {
  const writer = getWriter(name);
  if (!writer) throw new Error(`sveld: built-in writer "${name}" is not registered.`);
  return writer.write(components, options);
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
 * await writeOutput(result, {
 *   types: true,
 *   json: true,
 *   markdown: true
 * }, "./src/App.svelte");
 * // Generates: types/*.d.ts, COMPONENT_API.json, COMPONENT_INDEX.md
 * ```
 */
export async function writeOutput(
  result: GenerateBundleResult,
  opts: PluginSveldOptions & { dryRun?: boolean },
  input: string,
) {
  const inputDir = dirname(input);
  const dryRun = opts?.dryRun === true;

  if (opts?.types !== false) {
    /**
     * Use allComponentsForTypes to generate .d.ts for all discovered components.
     * This ensures TypeScript definitions are available for all components,
     * not just exported ones, which is useful for type checking.
     */
    await runBuiltInWriter("types", result.allComponentsForTypes, {
      outDir: "types",
      preamble: "",
      ...opts?.typesOptions,
      exports: result.exports,
      inputDir,
      dryRun,
      cache: result.cache,
      resolvedPathByFilePath: result.resolvedPathByFilePath,
    } satisfies WriteTsDefinitionsOptions);
  }

  if (opts?.json) {
    /**
     * Use components (exported only) for JSON metadata.
     * JSON output should only include components that are actually exported,
     * matching the public API surface.
     */
    await runBuiltInWriter("json", result.components, {
      outFile: "COMPONENT_API.json",
      ...opts?.jsonOptions,
      input,
      inputDir,
      entryExports: result.entryExports,
      dryRun,
    } satisfies WriteJsonOptions);
  }

  if (opts?.markdown) {
    /**
     * Use components (exported only) for Markdown documentation.
     * Documentation should only include exported components that are
     * part of the public API.
     */
    await runBuiltInWriter("markdown", result.components, {
      outFile: "COMPONENT_INDEX.md",
      ...opts?.markdownOptions,
      entryExports: result.entryExports,
      dryRun,
    } satisfies WriteMarkdownOptions);
  }

  if (opts?.customElements) {
    /**
     * Use components (exported only) for the Custom Elements Manifest, matching
     * the JSON/Markdown outputs' public-API-surface convention.
     */
    await runBuiltInWriter("custom-elements", result.components, {
      outFile: "custom-elements.json",
      ...opts?.customElementsOptions,
      inputDir,
      dryRun,
    } satisfies WriteCustomElementsOptions);
  }

  if (opts?.llms) {
    /**
     * Use components (exported only) for llms.txt/llms-full.txt, matching
     * the JSON/Markdown outputs' public-API-surface convention.
     */
    await runBuiltInWriter("llms", result.components, {
      ...opts?.llmsOptions,
      entryExports: result.entryExports,
      dryRun,
    } satisfies WriteLlmsOptions);
  }

  if (opts?.migrationReport) {
    /**
     * Use allComponentsForTypes, matching the .d.ts writer's convention: a
     * migration readiness report is only useful if it covers every
     * discovered component, not just the exported public API surface.
     */
    await runBuiltInWriter("migration-report", result.allComponentsForTypes, {
      ...opts?.migrationReportOptions,
      dryRun,
    } satisfies WriteMigrationReportOptions);
  }

  const additionalWrites = Object.entries(opts?.additionalWriters ?? {}).map(([name, writerOptions]) => {
    const writer = getWriter(name);
    if (!writer) {
      console.warn(`sveld: no writer registered with name "${name}"; skipping.`);
      return undefined;
    }
    const components = writer.componentSet === "all" ? result.allComponentsForTypes : result.components;
    return writer.write(components, writerOptions);
  });

  await Promise.all(additionalWrites);
}

/**
 * Prints the single selected `json` / `markdown` / `customElements` document
 * to stdout instead of writing it to disk. CLI-only: the caller (`cli()`) is
 * responsible for enforcing that exactly one of those three options is set
 * before calling this.
 */
export async function writeStdout(
  result: GenerateBundleResult,
  opts: PluginSveldOptions & { stdout?: boolean | "json" | "ndjson" },
  input: string,
) {
  const inputDir = dirname(input);

  if (opts?.json) {
    const jsonOptions = {
      ...opts?.jsonOptions,
      inputDir,
      entryExports: result.entryExports,
    } satisfies Pick<WriteJsonOptions, "inputDir" | "entryExports">;

    const rendered =
      opts.stdout === "ndjson"
        ? renderJsonLines(result.components, jsonOptions)
        : renderJsonDocument(result.components, jsonOptions);

    process.stdout.write(rendered);
    return;
  }

  if (opts?.markdown) {
    const rendered = renderMarkdownDocument(result.components, {
      ...opts?.markdownOptions,
      entryExports: result.entryExports,
    } satisfies Pick<WriteMarkdownOptions, "entryExports" | "onAppend">);
    process.stdout.write(rendered);
    return;
  }

  if (opts?.customElements) {
    const rendered = renderCustomElementsManifest(result.components, {
      ...opts?.customElementsOptions,
      inputDir,
    } satisfies Pick<WriteCustomElementsOptions, "inputDir">);
    process.stdout.write(rendered);
  }
}
