import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isObject } from "./ast-guards";
import { closestMatch } from "./levenshtein";
import type { PluginSveldOptions } from "./plugin";

/**
 * Options shared by the config file, the CLI, and the programmatic `sveld()`
 * API. Superset of `PluginSveldOptions` with the CLI-oriented flags that only
 * make sense as part of a full `sveld` run (not the Vite/Rollup plugin).
 */
export interface SveldRuntimeOptions extends PluginSveldOptions {
  /** Print unresolved-type diagnostics to stderr. */
  reportDiagnostics?: boolean;
  /**
   * Exit code 4 when diagnostics exist. Implies `reportDiagnostics`. Pass
   * `"errors"` to fail only on `severity: "error"` diagnostics
   * (`example-compile-error`, `syntax-skipped`), letting warnings
   * (`prop-unknown-type`, `context-any-type`, `event-no-source`) through.
   */
  strict?: boolean | "errors";
  /**
   * Diff the parsed component API against a committed snapshot (default:
   * the `json` writer's `outFile`, or `COMPONENT_API.json`) and assign a
   * semver bump to each change. Exits `3` on a breaking change. Pass a
   * string for a custom snapshot path.
   */
  check?: boolean | string;
  /** Suppress writer progress logs (`created "..."` / `unchanged "..."`). */
  quiet?: boolean;
  /**
   * Print the single selected `json` / `markdown` / `customElements` document
   * to stdout instead of writing it to disk. Requires exactly one of those
   * three outputs; CLI-only (the Vite plugin ignores it). `"ndjson"` is only
   * valid with `json` and prints one minified JSON object per component per
   * line instead of the single combined document.
   */
  stdout?: boolean | "json" | "ndjson";
  /**
   * Output format for the `--check` report and the `--report-diagnostics` /
   * `--strict` diagnostics summary: `"text"` (default) or `"json"`. Channels
   * are unchanged, the check report on stdout and diagnostics on stderr.
   */
  format?: "text" | "json";
  /**
   * Resolve the entry, load config, and parse components as usual, but print
   * `would write "<path>"` for each output file to stdout instead of writing
   * it (including the parse cache). CLI-only; the Vite plugin ignores it.
   */
  dryRun?: boolean;
}

/**
 * Public shape of a `sveld.config.{js,ts,mjs}` file. Identical to the options
 * accepted by the CLI and the programmatic `sveld()` API.
 */
export type SveldConfig = SveldRuntimeOptions;

/** Config file names probed at the project root. First existing file wins. */
const CONFIG_FILE_NAMES = ["sveld.config.js", "sveld.config.mjs", "sveld.config.ts"] as const;

/**
 * Identity helper that fully types a `sveld` config object.
 *
 * @example
 * ```ts
 * // sveld.config.js
 * import { defineConfig } from "sveld";
 *
 * export default defineConfig({
 *   glob: true,
 *   json: true,
 *   markdown: true,
 * });
 * ```
 */
export function defineConfig(config: SveldConfig): SveldConfig {
  return config;
}

/** Locate a `sveld.config.{js,mjs,ts}` file in `cwd`, or `null` if none exists. */
export function resolveConfigPath(cwd: string = process.cwd()): string | null {
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = join(cwd, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Load and validate a `sveld` config file by absolute path.
 *
 * The package is ESM-only, so the file is loaded via dynamic `import()`. A
 * cache-busting query is appended so repeated loads (e.g. across tests or
 * watch runs) reflect the latest contents.
 *
 * @throws if the module cannot be imported (e.g. a syntax error or a config
 * that throws at evaluation time) or if it does not default-export an object.
 */
export async function loadConfigFrom(configPath: string): Promise<SveldConfig> {
  let mod: { default?: unknown };

  try {
    const href = `${pathToFileURL(configPath).href}?t=${Date.now()}`;
    mod = await import(href);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`sveld: failed to load config file "${configPath}".\n${message}`);
  }

  const config = mod.default;

  if (!isObject(config) || Array.isArray(config)) {
    throw new Error(
      `sveld: config file "${configPath}" must export a configuration object as its default export. ` +
        "Did you forget `export default defineConfig({ ... })`?",
    );
  }

  return config as SveldConfig;
}

/**
 * Discover and load a `sveld.config.{js,mjs,ts}` file from `cwd`.
 * Returns an empty object when no config file is present.
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<SveldConfig> {
  const configPath = resolveConfigPath(cwd);

  if (configPath === null) {
    return {};
  }

  return loadConfigFrom(configPath);
}

/**
 * Merge option sources. Later sources override earlier ones. Keys whose
 * value is a plain object (e.g. `typesOptions`, `jsonOptions`,
 * `markdownOptions`, `customElementsOptions`, `additionalWriters`) are
 * merged one level deep instead of replaced outright, so setting one nested
 * key from a later source doesn't drop sibling keys set by an earlier one.
 * Arrays and functions always replace; they are never merged.
 */
export function mergeConfig<T extends PluginSveldOptions = PluginSveldOptions>(
  ...sources: Array<Partial<T> | undefined>
): Partial<T> {
  const merged: Record<string, unknown> = {};

  for (const source of sources) {
    if (!source) continue;

    for (const [key, value] of Object.entries(source)) {
      const existing = merged[key];
      merged[key] =
        isObject(existing) && !Array.isArray(existing) && isObject(value) && !Array.isArray(value)
          ? { ...existing, ...value }
          : value;
    }
  }

  return merged as Partial<T>;
}

/** Top-level keys accepted anywhere in `PluginSveldOptions` / `SveldRuntimeOptions`. */
const KNOWN_TOP_LEVEL_KEYS = [
  "entry",
  "glob",
  "quiet",
  "documentExports",
  "types",
  "typesOptions",
  "json",
  "jsonOptions",
  "markdown",
  "markdownOptions",
  "customElements",
  "customElementsOptions",
  "llms",
  "llmsOptions",
  "additionalWriters",
  "failFast",
  "watch",
  "config",
  "resolveTypes",
  "cache",
  "checkExamples",
  "reportDiagnostics",
  "strict",
  "check",
  "stdout",
  "format",
  "dryRun",
  "diagnostics",
];

/** Known keys inside each `*Options` object, keyed by the top-level option name. `additionalWriters` is userland-defined and not validated here. */
const KNOWN_NESTED_KEYS: Record<string, string[]> = {
  typesOptions: ["outDir", "preamble", "format", "exports", "dryRun", "cache", "resolvedPathByFilePath"],
  jsonOptions: ["input", "outFile", "outDir", "entryExports", "dryRun"],
  markdownOptions: ["write", "outFile", "entryExports", "onAppend", "dryRun"],
  customElementsOptions: ["outFile", "dryRun"],
  llmsOptions: ["outDir", "linkBase", "title", "summary", "entryExports", "dryRun"],
  diagnostics: ["ignore"],
};

/** Prints a "did you mean" suggestion for an unrecognized option key. `prefix` namespaces nested keys, e.g. `"typesOptions"` for `typesOptions.printWidth`. */
function warnUnknownKey(prefix: string | null, key: string, candidates: string[]): void {
  const path = prefix === null ? key : `${prefix}.${key}`;
  const suggestion = closestMatch(key, candidates);
  const suggestionPath =
    suggestion === undefined ? undefined : prefix === null ? suggestion : `${prefix}.${suggestion}`;
  console.warn(`sveld: unknown option "${path}".${suggestionPath ? ` Did you mean "${suggestionPath}"?` : ""}`);
}

/**
 * Warns (via `console.warn`) about unknown top-level option keys and unknown
 * keys inside each `*Options` object. Never throws: an unrecognized option
 * is surfaced as a hint, not a fatal error.
 */
export function validateOptions(options: Partial<PluginSveldOptions>): void {
  for (const key of Object.keys(options)) {
    if (!KNOWN_TOP_LEVEL_KEYS.includes(key)) {
      warnUnknownKey(null, key, KNOWN_TOP_LEVEL_KEYS);
    }
  }

  for (const [optionsKey, knownKeys] of Object.entries(KNOWN_NESTED_KEYS)) {
    const nested = (options as Record<string, unknown>)[optionsKey];
    if (!isObject(nested)) continue;

    for (const key of Object.keys(nested)) {
      if (!knownKeys.includes(key)) {
        warnUnknownKey(optionsKey, key, knownKeys);
      }
    }
  }
}
