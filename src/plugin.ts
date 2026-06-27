import { dirname } from "node:path";
import {
  type GenerateBundleOptions,
  type GenerateBundleResult,
  generateBundle,
  toGenerateBundleOptions,
} from "./bundle";
import { getSvelteEntry } from "./get-svelte-entry";
import { createSveldBundle, type SveldBundle } from "./watch";
import writeJson, { type WriteJsonOptions } from "./writer/writer-json";
import writeMarkdown, { type WriteMarkdownOptions } from "./writer/writer-markdown";
import writeTsDefinitions, { type WriteTsDefinitionsOptions } from "./writer/writer-ts-definitions";

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

export interface PluginSveldOptions extends Pick<GenerateBundleOptions, "resolveTypes"> {
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
  writeBundle(): void;
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
      writeOutput(next, opts || {}, input);
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
        writeOutput(bundle.result, opts || {}, input);
      }
    },
    async generateBundle() {
      // In watch mode the initial build happens in `buildStart`.
      if (watch) return;
      if (input != null) {
        result = await generateBundle(input, opts?.glob === true, toGenerateBundleOptions(opts));
      }
    },
    writeBundle() {
      if (watch) return;
      if (input != null) writeOutput(result, opts || {}, input);
    },
    handleHotUpdate(ctx) {
      scheduleUpdate(ctx.file);
    },
    watchChange(id) {
      scheduleUpdate(id);
    },
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
      entryExports: result.entryExports,
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
      entryExports: result.entryExports,
    });
  }
}
