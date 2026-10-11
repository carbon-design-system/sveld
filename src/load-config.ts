import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
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
  /**
   * Minimum bump `--check` fails the run (exit `3`) on: `"major"`
   * (default), `"minor"`, or `"patch"`.
   */
  checkLevel?: "major" | "minor" | "patch";
  /**
   * Print the single selected `json` / `markdown` document to stdout
   * instead of writing it to disk. Requires exactly one of those two
   * outputs; CLI-only (the Vite plugin ignores it).
   */
  stdout?: boolean;
  /**
   * Output format for the `--check` report and the `--report-diagnostics` /
   * `--strict` diagnostics summary: `"text"` (default) or `"json"`. The
   * check report goes to stdout and the summary to stderr. `sveld()` prints
   * only the summary.
   */
  format?: "text" | "json";
}

/**
 * Public shape of a `sveld.config.{js,ts,mjs}` file. Identical to the options
 * accepted by the CLI and the programmatic `sveld()` API.
 */
export type SveldConfig = SveldRuntimeOptions;

/** First existing file wins. */
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
 * The cache-busting query makes repeated loads (tests, watch runs) see the
 * latest contents. Throws if the import fails or the default export isn't an object.
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

/** `{}` when `cwd` has no config file. */
export async function loadConfig(cwd: string = process.cwd()): Promise<SveldConfig> {
  const configPath = resolveConfigPath(cwd);
  return configPath === null ? {} : loadConfigFrom(configPath);
}

/**
 * The config a `config` option asks for: a path (relative to `cwd`) loads that file and
 * must exist, `true` discovers one in `cwd`, `false` loads none, and unset does `discover`.
 */
export async function loadConfigOption(
  config: boolean | string | undefined,
  cwd: string,
  discover: boolean,
): Promise<SveldConfig> {
  if (typeof config === "string") {
    const configPath = resolve(cwd, config);
    if (!existsSync(configPath)) throw new Error(`sveld: config file "${config}" does not exist.`);
    return loadConfigFrom(configPath);
  }
  return (config ?? discover) ? loadConfig(cwd) : {};
}

/**
 * Later sources win. Plain-object values (`typesOptions`, ...) merge one
 * level deep so a later source's nested key doesn't drop earlier siblings;
 * arrays and functions replace.
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
  "failFast",
  "watch",
  "config",
  "cache",
  "checkExamples",
  "reportDiagnostics",
  "strict",
  "check",
  "checkLevel",
  "stdout",
  "format",
  "diagnostics",
];

const KNOWN_NESTED_KEYS: Record<string, string[]> = {
  typesOptions: ["outDir", "preamble", "format", "transform", "indexTypes"],
  jsonOptions: ["outFile", "outDir", "source"],
  markdownOptions: ["outFile", "outDir", "onAppend"],
  diagnostics: ["ignore"],
};

function warnUnknownKey(prefix: string | null, key: string, candidates: string[]): void {
  const path = prefix === null ? key : `${prefix}.${key}`;
  const suggestion = closestMatch(key, candidates);
  const suggestionPath =
    suggestion === undefined ? undefined : prefix === null ? suggestion : `${prefix}.${suggestion}`;
  console.warn(`sveld: unknown option "${path}".${suggestionPath ? ` Did you mean "${suggestionPath}"?` : ""}`);
}

/** Warns about unknown option keys, top-level and nested. Never throws. */
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
