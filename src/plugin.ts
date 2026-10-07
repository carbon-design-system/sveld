import { dirname, isAbsolute, resolve } from "node:path";
import {
  type GenerateBundleOptions,
  type GenerateBundleResult,
  generateBundle,
  toGenerateBundleOptions,
} from "./bundle";
import { getSvelteEntry, UNRESOLVED_ENTRY_MESSAGE } from "./get-svelte-entry";
import { loadConfig, loadConfigFrom, mergeConfig, validateOptions } from "./load-config";
import { setQuiet } from "./logger";
import { WATCH_RELEVANT_EXT_REGEX } from "./path";
import { createSveldBundle, type SveldBundle } from "./watch";
import writeJson, { type JsonOptions, renderJsonDocument, type WriteJsonOptions } from "./writer/writer-json";
import writeMarkdown, {
  type MarkdownOptions,
  renderMarkdownDocument,
  type WriteMarkdownOptions,
} from "./writer/writer-markdown";
import writeTsDefinitions, { type TypesOptions, type WriteTsDefinitionsOptions } from "./writer/writer-ts-definitions";

export type { ComponentDocApi, ComponentDocs, GenerateBundleResult } from "./bundle";
export { generateBundle, toGenerateBundleOptions } from "./bundle";
export type { JsonOptions, MarkdownOptions, TypesOptions };

export interface PluginSveldOptions extends Pick<GenerateBundleOptions, "cache" | "checkExamples" | "diagnostics"> {
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
  typesOptions?: TypesOptions;
  json?: boolean;
  jsonOptions?: JsonOptions;
  markdown?: boolean;
  markdownOptions?: MarkdownOptions;
  /**
   * Abort the entire run when a single component fails to parse.
   * When `false` (the default), parse failures are collected as diagnostics
   * and the remaining components still emit their output.
   */
  failFast?: boolean;
  /**
   * Regenerate output incrementally when relevant source changes during
   * `vite dev` / `vite build --watch`: a component, the entry barrel itself
   * (adding/removing an export), a module a component reads a value from,
   * or a non-`.svelte` file a component names via `@extendProps` /
   * `@extends`. Only the edited components and those that read an edited
   * module are re-parsed.
   * @default false
   */
  watch?: boolean;
}

// Structural subsets of the Vite/Rollup types, so neither is a dependency.
interface HotUpdateContext {
  file: string;
}

interface RollupPluginContext {
  error(message: string): never;
}

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

/** Matches `sveld()`'s thrown message. */

/**
 * `sveld.config` keys that only the CLI and `sveld()` act on: the plugin
 * neither reports diagnostics nor diffs a snapshot, so a config shared with
 * the CLI would otherwise look like it applies here too.
 */
const RUNTIME_ONLY_KEYS = ["reportDiagnostics", "strict", "check", "checkLevel", "stdout", "format"];

const WATCH_DEBOUNCE_MS = 50;

/**
 * Serializes calls to `run`: a call made while one is in flight queues behind
 * it. Watch-mode flushes mutate a shared `SveldBundle` and would otherwise race.
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
  // Hooks read this, not `opts`, so a config file loaded in `buildStart` applies.
  let mergedOpts: PluginSveldOptions = opts ?? {};
  let root: string | undefined;

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
      next.cache?.save();
    } catch (error) {
      console.error("sveld: failed to regenerate types in watch mode:", error);
    }
  };

  const flush = createSerialQueue(runFlush);

  const scheduleUpdate = (id: string) => {
    if (!watch || bundle == null || !WATCH_RELEVANT_EXT_REGEX.test(id)) return;
    pending.add(id);
    clearTimeout(timer);
    timer = setTimeout(flush, WATCH_DEBOUNCE_MS);
  };

  return {
    name: "vite-plugin-sveld",
    // Watch mode also runs under the dev server.
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
      const ignored = RUNTIME_ONLY_KEYS.filter((key) => key in mergedOpts);
      if (ignored.length > 0) {
        console.warn(
          `sveld: the Vite plugin ignores ${ignored.map((key) => `"${key}"`).join(", ")}; run the sveld CLI or sveld() for them.`,
        );
      }
      setQuiet(mergedOpts.quiet === true);
      input = getSvelteEntry(mergedOpts.entry);
      if (watch && input != null) {
        // The initial output, here since `vite dev` never fires
        // generateBundle/writeBundle. A failure must not crash the dev server.
        try {
          bundle = await createSveldBundle(input, mergedOpts.glob === true, toGenerateBundleOptions(mergedOpts));
          const initial = await bundle.result;
          await writeOutput(initial, mergedOpts, input);
          initial.cache?.save();
        } catch (error) {
          console.error("sveld: failed to generate initial types in watch mode:", error);
        }
      }
    },
    async generateBundle() {
      // Watch mode builds in `buildStart`.
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
      // Persists the `.d.ts` text writeOutput just cached.
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

/** `.d.ts` covers every discovered component; JSON and Markdown only the exported ones. */
export async function writeOutput(result: GenerateBundleResult, opts: PluginSveldOptions, input: string) {
  const inputDir = dirname(input);

  if (opts.types !== false) {
    await writeTsDefinitions(result.allComponentsForTypes, {
      outDir: "types",
      preamble: "",
      ...opts.typesOptions,
      exports: result.exports,
      inputDir,
      cache: result.cache,
      resolvedPathByFilePath: result.resolvedPathByFilePath,
      crossFileResolvedPathByFilePath: result.crossFileResolvedPathByFilePath,
    } satisfies WriteTsDefinitionsOptions);
  }

  if (opts.json) {
    await writeJson(result.components, {
      outFile: "COMPONENT_API.json",
      ...opts.jsonOptions,
      inputDir,
      entryExports: result.entryExports,
    } satisfies WriteJsonOptions);
  }

  if (opts.markdown) {
    await writeMarkdown(result.components, {
      outFile: "COMPONENT_INDEX.md",
      ...opts.markdownOptions,
      entryExports: result.entryExports,
    } satisfies WriteMarkdownOptions);
  }
}

/** Prints the `json` or `markdown` document to stdout. The CLI ensures exactly one is set. */
export async function writeStdout(result: GenerateBundleResult, opts: PluginSveldOptions, input: string) {
  if (opts.json) {
    const rendered = renderJsonDocument(result.components, {
      ...opts.jsonOptions,
      inputDir: dirname(input),
      entryExports: result.entryExports,
    } satisfies Pick<WriteJsonOptions, "inputDir" | "entryExports" | "source">);
    process.stdout.write(rendered);
    return;
  }

  if (opts.markdown) {
    const rendered = renderMarkdownDocument(result.components, {
      ...opts.markdownOptions,
      entryExports: result.entryExports,
    } satisfies Pick<WriteMarkdownOptions, "entryExports" | "onAppend">);
    process.stdout.write(rendered);
  }
}
