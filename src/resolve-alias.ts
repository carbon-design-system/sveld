import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { normalizeSeparators } from "./path";
import { type ParsedTsConfig, parseTsConfig } from "./validate";

interface TSConfig extends ParsedTsConfig {}

const configCache = new Map<string, TSConfig | null>();
const pathPatternRegexCache = new Map<string, RegExp>();

const COMMENT_PATTERN = /\/\*[\s\S]*?\*\/|\/\/.*/g;
const REGEX_SPECIAL_CHARS = /[.+?^${}()|[\]\\]/g;

/** Extensions probed when checking whether an alias mapping candidate exists on disk. */
const ALIAS_CANDIDATE_EXTENSIONS = [".svelte", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".d.ts"];

/**
 * Thrown when a module specifier (an `export *`/named re-export source, or a
 * path alias) cannot be resolved to a file on disk.
 */
export class UnresolvedModuleError extends Error {
  readonly specifier: string;
  readonly fromFile: string;
  readonly searched: string;

  constructor(specifier: string, fromFile: string, searched: string) {
    super(`cannot resolve "${specifier}" from ${fromFile || "."} (${searched})`);
    this.name = "UnresolvedModuleError";
    this.specifier = specifier;
    this.fromFile = fromFile;
    this.searched = searched;
  }
}

/** True when `fullPath` (or `fullPath` plus a common module extension) exists on disk. */
function pathAliasTargetExists(fullPath: string): boolean {
  if (existsSync(fullPath)) return true;
  return ALIAS_CANDIDATE_EXTENSIONS.some((ext) => existsSync(fullPath + ext));
}

/** Length of the literal (non-wildcard) prefix of a tsconfig `paths` pattern, for longest-prefix ordering. */
function patternPrefixLength(pattern: string): number {
  const wildcardIndex = pattern.indexOf("*");
  return wildcardIndex === -1 ? pattern.length : wildcardIndex;
}

/** Clears cached tsconfig/jsconfig reads (tests and hot reload). */
export function clearConfigCache() {
  configCache.clear();
}

/**
 * Finds the nearest tsconfig.json or jsconfig.json starting from a directory.
 *
 * @example
 * ```ts
 * // From ./src/components/Button.svelte
 * findConfig("./src/components")
 * // Returns: "./tsconfig.json" (if found in project root)
 * ```
 */
function findConfig(startDir: string): string | null {
  let dir = startDir;
  const root = resolve(dir, "/");

  while (dir !== root) {
    for (const configName of ["tsconfig.json", "jsconfig.json"]) {
      const configPath = join(dir, configName);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    dir = dirname(dir);
  }

  return null;
}

function parseConfig(configPath: string): TSConfig | null {
  if (configCache.has(configPath)) {
    return configCache.get(configPath) ?? null;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    // Parse raw JSON first: naive comment stripping treats `/*` inside strings
    // (e.g. tsconfig `"$lib/*"`) as a block comment and corrupts the file.
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonContent = content.replace(COMMENT_PATTERN, "");
      parsed = JSON.parse(jsonContent);
    }
    const config: TSConfig = parseTsConfig(parsed);

    if (config.extends) {
      const baseConfigPath = isAbsolute(config.extends) ? config.extends : resolve(dirname(configPath), config.extends);

      const fullBaseConfigPath = baseConfigPath.endsWith(".json") ? baseConfigPath : `${baseConfigPath}.json`;

      if (existsSync(fullBaseConfigPath)) {
        const baseConfig = parseConfig(fullBaseConfigPath);
        if (baseConfig) {
          config.compilerOptions = {
            ...baseConfig.compilerOptions,
            ...config.compilerOptions,
            paths: {
              ...baseConfig.compilerOptions?.paths,
              ...config.compilerOptions?.paths,
            },
          };
        }
      }
    }

    configCache.set(configPath, config);
    return config;
  } catch {
    configCache.set(configPath, null);
    return null;
  }
}

/** Result of looking up a specifier against tsconfig/jsconfig `paths`. */
export interface AliasLookup {
  /** Absolute path when resolved via an alias mapping; `importPath` unchanged otherwise. */
  resolved: string;
  /** True when `importPath` is a non-relative specifier that no `paths` entry matched. */
  unresolved: boolean;
  /** Human-readable description of what was searched, for error messages. */
  searched: string;
}

function getPatternRegex(pattern: string): RegExp {
  let regex = pathPatternRegexCache.get(pattern);
  if (!regex) {
    const escapedPattern = pattern
      .split("*")
      .map((part) => part.replace(REGEX_SPECIAL_CHARS, "\\$&"))
      .join("(.*)");

    regex = new RegExp(`^${escapedPattern}$`);
    pathPatternRegexCache.set(pattern, regex);
  }
  return regex;
}

/**
 * Resolve a tsconfig/jsconfig path alias, reporting whether resolution failed.
 *
 * Patterns are tried longest non-wildcard-prefix first (mirroring `tsc`), not
 * JSON key order. Within a matched pattern, every mapping is tried in order
 * and the first one that exists on disk wins; if none exist, the first
 * mapping is returned as a best-effort guess.
 */
export function resolveAliasLookup(importPath: string, fromDir: string): AliasLookup {
  if (importPath.startsWith(".") || importPath.startsWith("/")) {
    return { resolved: importPath, unresolved: false, searched: "" };
  }

  const configPath = findConfig(fromDir);
  if (!configPath) {
    return { resolved: importPath, unresolved: true, searched: "no tsconfig/jsconfig paths found" };
  }

  const config = parseConfig(configPath);
  if (!config?.compilerOptions?.paths) {
    return { resolved: importPath, unresolved: true, searched: "no tsconfig/jsconfig paths found" };
  }

  const { baseUrl = ".", paths } = config.compilerOptions;
  const configDir = dirname(configPath);
  const resolvedBaseUrl = resolve(configDir, baseUrl);

  const patterns = Object.entries(paths).sort(
    ([a], [b]) => patternPrefixLength(b) - patternPrefixLength(a),
  );

  for (const [pattern, mappings] of patterns) {
    const match = importPath.match(getPatternRegex(pattern));
    if (!match) continue;

    let firstCandidate: string | undefined;
    for (const mapping of mappings) {
      let resolvedPath = mapping;
      for (let i = 1; i < match.length; i++) {
        resolvedPath = resolvedPath.replace("*", match[i]);
      }

      const fullPath = resolve(resolvedBaseUrl, resolvedPath);
      if (firstCandidate === undefined) firstCandidate = fullPath;
      if (pathAliasTargetExists(fullPath)) {
        return { resolved: fullPath, unresolved: false, searched: configPath };
      }
    }

    return { resolved: firstCandidate ?? importPath, unresolved: false, searched: configPath };
  }

  return { resolved: importPath, unresolved: true, searched: `tsconfig paths (${configPath})` };
}

/**
 * Resolve a tsconfig/jsconfig path alias to an absolute filesystem path.
 *
 * @example
 * ```ts
 * // With tsconfig.json: { "paths": { "$lib/*": ["./src/lib/*"] } }
 * resolvePathAliasAbsolute("$lib/utils", "./src")
 * // Returns: "/absolute/path/to/src/lib/utils"
 *
 * resolvePathAliasAbsolute("./relative", "./src")
 * // Returns: "./relative" (unchanged, not an alias)
 * ```
 */
export function resolvePathAliasAbsolute(importPath: string, fromDir: string): string {
  return resolveAliasLookup(importPath, fromDir).resolved;
}

/**
 * Resolve a path alias to a path relative to `fromDir` for generated exports.
 *
 * @example
 * ```ts
 * // With alias "$lib/utils" -> "./src/lib/utils"
 * resolvePathAlias("$lib/utils", "./src")
 * // Returns: "./lib/utils"
 *
 * resolvePathAlias("./Button.svelte", "./src")
 * // Returns: "./Button.svelte" (unchanged, not an alias)
 * ```
 */
export function resolvePathAlias(importPath: string, fromDir: string): string {
  if (importPath.startsWith(".") || importPath.startsWith("/")) {
    return importPath;
  }

  const absolutePath = resolvePathAliasAbsolute(importPath, fromDir);

  if (absolutePath === importPath) {
    return importPath;
  }

  let relativePath = relative(fromDir, absolutePath);
  relativePath = normalizeSeparators(relativePath);

  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}
