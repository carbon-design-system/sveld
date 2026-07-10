import { dirname } from "node:path";
import {
  type ComponentDocs,
  type GenerateBundleOptions,
  type GenerateBundleResult,
  generateBundle,
  toGenerateBundleOptions,
} from "./bundle";
import { getSvelteEntry } from "./get-svelte-entry";
import { createSveldBundle, type SveldBundle } from "./watch";
// Side-effect import: registers the built-in "json"/"markdown"/"types"/"custom-elements" writers.
import "./writer/built-in-writers";
import { getWriter } from "./writer/registry";
import { renderCustomElementsManifest, type WriteCustomElementsOptions } from "./writer/writer-custom-elements";
import { renderJsonDocument, type WriteJsonOptions } from "./writer/writer-json";
import { renderMarkdownDocument, type WriteMarkdownOptions } from "./writer/writer-markdown";
import type { WriteTsDefinitionsOptions } from "./writer/writer-ts-definitions";

export type {
  CollectedComponents,
  ComponentDocApi,
  ComponentDocs,
  ComponentParseError,
  GenerateBundleOptions,
  GenerateBundleResult,
  ResolveComponentFilePath,
} from "./bundle";
export {
  collectComponents,
  collectSvelteFilePaths,
  generateBundle,
  processComponent,
  readFileMap,
  reportParseErrors,
  toGenerateBundleOptions,
} from "./bundle";

export interface PluginSveldOptions extends Pick<GenerateBundleOptions, "resolveTypes" | "cache" | "checkExamples"> {
  /**
   * Specify the entry point to uncompiled Svelte source.
   * If not provided, sveld will use the "svelte" field from package.json.
   */
  entry?: string;
  glob?: boolean;
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
   * Regenerate output incrementally when `.svelte` source changes during
   * `vite dev` / `vite build --watch`. Only the changed component and the
   * components that depend on it via `@extendProps` / `@extends` are re-parsed.
   * @default false
   */
  watch?: boolean;
}

/** Subset of Vite/Rollup's HMR context that the watch hook relies on. */
interface HotUpdateContext {
  file: string;
}

interface SveldPlugin {
  name: string;
  apply?: "build" | "serve";
  enforce?: "pre" | "post";
  buildStart(): void | Promise<void>;
  generateBundle(): Promise<void>;
  writeBundle(): Promise<void>;
  /** Vite dev-server HMR hook (serve mode). */
  handleHotUpdate?(ctx: HotUpdateContext): void;
  /** Rollup/Vite watch hook (build `--watch`). */
  watchChange?(id: string): void;
}

/** Debounce window (ms) for coalescing rapid file changes into one regeneration. */
const WATCH_DEBOUNCE_MS = 50;

const SVELTE_EXT_REGEX = /\.svelte$/;

export default function pluginSveld(opts?: PluginSveldOptions): SveldPlugin {
  const watch = opts?.watch === true;
  let result: GenerateBundleResult;
  let input: string | null;

  // Watch-mode state: a long-lived bundle that supports scoped re-parsing.
  let bundle: SveldBundle | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Set<string>();

  const flush = async () => {
    if (bundle == null || input == null || pending.size === 0) return;
    const changed = Array.from(pending);
    pending.clear();
    try {
      const { result: next } = await bundle.update(changed);
      await writeOutput(next, opts || {}, input);
    } catch (error) {
      console.error("sveld: failed to regenerate types in watch mode:", error);
    }
  };

  const scheduleUpdate = (id: string) => {
    if (!watch || bundle == null || !SVELTE_EXT_REGEX.test(id)) return;
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
    async buildStart() {
      input = getSvelteEntry(opts?.entry);
      if (watch && input != null) {
        // Produce the initial output and prime the incremental bundle. This
        // covers both `vite dev` (where generateBundle/writeBundle never fire)
        // and `vite build --watch`.
        bundle = await createSveldBundle(input, opts?.glob === true, opts?.documentExports === true);
        await writeOutput(bundle.result, opts || {}, input);
      }
    },
    async generateBundle() {
      // In watch mode the initial build happens in `buildStart`.
      if (watch) return;
      if (input != null) {
        result = await generateBundle(input, opts?.glob === true, toGenerateBundleOptions(opts));
      }
    },
    async writeBundle() {
      if (watch) return;
      if (input != null) await writeOutput(result, opts || {}, input);
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
  name: "types" | "json" | "markdown" | "custom-elements",
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
export async function writeOutput(result: GenerateBundleResult, opts: PluginSveldOptions, input: string) {
  const inputDir = dirname(input);

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
    } satisfies WriteCustomElementsOptions);
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
export async function writeStdout(result: GenerateBundleResult, opts: PluginSveldOptions, input: string) {
  const inputDir = dirname(input);

  if (opts?.json) {
    const rendered = renderJsonDocument(result.components, {
      ...opts?.jsonOptions,
      inputDir,
      entryExports: result.entryExports,
    } satisfies Pick<WriteJsonOptions, "inputDir" | "entryExports">);
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
