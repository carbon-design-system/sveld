import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { PluginSveldOptions } from "./plugin";
import { isRecord } from "./validate";

/**
 * Options shared by the config file, the CLI, and the programmatic `sveld()`
 * API. Superset of `PluginSveldOptions` with the CLI-oriented flags that only
 * make sense as part of a full `sveld` run (not the Vite/Rollup plugin).
 */
export interface SveldRuntimeOptions extends PluginSveldOptions {
  /** Print unresolved-type diagnostics to stderr. */
  reportDiagnostics?: boolean;
  /** Exit code 1 when diagnostics exist. Implies `reportDiagnostics`. */
  strict?: boolean;
  /**
   * Diff the parsed component API against a committed snapshot (default:
   * the `json` writer's `outFile`, or `COMPONENT_API.json`) and assign a
   * semver bump to each change. Exits `1` on a breaking change. Pass a
   * string for a custom snapshot path.
   */
  check?: boolean | string;
  /** Suppress writer progress logs (`created "..."` / `unchanged "..."`). */
  quiet?: boolean;
  /**
   * Print the single selected `json` / `markdown` / `customElements` document
   * to stdout instead of writing it to disk. Requires exactly one of those
   * three outputs; CLI-only (the Vite plugin ignores it).
   */
  stdout?: boolean;
}

/**
 * Public shape of a `sveld.config.{js,ts,mjs}` file. Identical to the options
 * accepted by the CLI and the programmatic `sveld()` API.
 */
export type SveldConfig = SveldRuntimeOptions;

/** Config file names probed at the project root. First existing file wins. */
export const CONFIG_FILE_NAMES = ["sveld.config.js", "sveld.config.mjs", "sveld.config.ts"] as const;

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

  if (!isRecord(config) || Array.isArray(config)) {
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

/** Shallow-merge option sources. Later sources override earlier ones. */
export function mergeConfig<T extends PluginSveldOptions = PluginSveldOptions>(
  ...sources: Array<Partial<T> | undefined>
): Partial<T> {
  return Object.assign({}, ...sources.filter(Boolean));
}
