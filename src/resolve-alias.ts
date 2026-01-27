import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { normalizeSeparators } from "./path";

interface TSConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
  extends?: string;
}

const configCache = new Map<string, TSConfig | null>();
const pathPatternRegexCache = new Map<string, RegExp>();

const COMMENT_PATTERN = /\/\*[\s\S]*?\*\/|\/\/.*/g;
const REGEX_SPECIAL_CHARS = /[.+?^${}()|[\]\\]/g;

/**
 * Clears the TypeScript/JavaScript config cache.
 *
 * Useful for testing or when config files are modified during runtime.
 * Forces re-reading of config files on next resolution.
 */
export function clearConfigCache() {
  configCache.clear();
}

/**
 * Finds the nearest tsconfig.json or jsconfig.json starting from a directory.
 *
 * Walks up the directory tree from the start directory until it finds
 * a config file or reaches the filesystem root.
 *
 * @param startDir - The directory to start searching from
 * @returns The path to the config file, or null if not found
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
    const jsonContent = content.replace(COMMENT_PATTERN, "");
    const config: TSConfig = JSON.parse(jsonContent);

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

/**
 * Resolves a path alias to an absolute file system path for reading files.
 *
 * Uses TypeScript/JavaScript config path mappings to resolve aliases like
 * `$lib/components` to actual file system paths. Handles wildcard patterns
 * and baseUrl resolution.
 *
 * @param importPath - The import path that may contain an alias
 * @param fromDir - The directory to resolve relative to (for finding config)
 * @returns The absolute resolved path, or original path if resolution fails
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
  if (importPath.startsWith(".") || importPath.startsWith("/")) {
    return importPath;
  }

  const configPath = findConfig(fromDir);
  if (!configPath) {
    return importPath;
  }

  const config = parseConfig(configPath);
  if (!config?.compilerOptions?.paths) {
    return importPath;
  }

  const { baseUrl = ".", paths } = config.compilerOptions;
  const configDir = dirname(configPath);
  const resolvedBaseUrl = resolve(configDir, baseUrl);

  // Try to match against path patterns
  for (const [pattern, mappings] of Object.entries(paths)) {
    /**
     * Convert TS path pattern to regex.
     * Examples:
     * - "$lib/*" -> /^\$lib\/(.*)$/
     * - "$lib" -> /^\$lib$/
     * - "@components/*" -> /^@components\/(.*)$/
     */
    let regex = pathPatternRegexCache.get(pattern);
    if (!regex) {
      /**
       * Escape special regex chars but keep * for replacement.
       * The * wildcard is converted to a capture group for substitution.
       */
      const escapedPattern = pattern
        .split("*")
        .map((part) => part.replace(REGEX_SPECIAL_CHARS, "\\$&"))
        .join("(.*)");

      regex = new RegExp(`^${escapedPattern}$`);
      pathPatternRegexCache.set(pattern, regex);
    }

    const match = importPath.match(regex);

    if (match) {
      // TypeScript uses the first matching pattern
      const mapping = mappings[0];
      if (!mapping) continue;

      // Replace * in mapping with captured groups (e.g., "$lib/*" matching "$lib/utils" -> "utils")
      let resolvedPath = mapping;
      for (let i = 1; i < match.length; i++) {
        resolvedPath = resolvedPath.replace("*", match[i]);
      }

      // Resolve relative to baseUrl from tsconfig
      const fullPath = resolve(resolvedBaseUrl, resolvedPath);

      return fullPath;
    }
  }

  return importPath;
}

/**
 * Resolves a path alias and converts it to a relative path from fromDir.
 *
 * This is used for storing paths in the exports object for output generation.
 * Unlike `resolvePathAliasAbsolute`, this returns a relative path suitable
 * for use in generated export statements.
 *
 * @param importPath - The import path that may contain an alias
 * @param fromDir - The directory to resolve relative to
 * @returns A relative path (prefixed with ./ if needed), or original path if resolution fails
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

  /**
   * Normalize path separators to forward slashes for consistency across platforms.
   * Windows uses backslashes, but we want forward slashes in generated code
   * for cross-platform compatibility.
   */
  relativePath = normalizeSeparators(relativePath);

  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}
