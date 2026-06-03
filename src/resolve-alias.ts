import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { normalizeSeparators } from "./path";
import { type ParsedTsConfig, parseTsConfig } from "./validate";

interface TSConfig extends ParsedTsConfig {}

const configCache = new Map<string, TSConfig | null>();
const pathPatternRegexCache = new Map<string, RegExp>();

const COMMENT_PATTERN = /\/\*[\s\S]*?\*\/|\/\/.*/g;
const REGEX_SPECIAL_CHARS = /[.+?^${}()|[\]\\]/g;

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
    const jsonContent = content.replace(COMMENT_PATTERN, "");
    const config: TSConfig = parseTsConfig(JSON.parse(jsonContent));

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

  for (const [pattern, mappings] of Object.entries(paths)) {
    let regex = pathPatternRegexCache.get(pattern);
    if (!regex) {
      const escapedPattern = pattern
        .split("*")
        .map((part) => part.replace(REGEX_SPECIAL_CHARS, "\\$&"))
        .join("(.*)");

      regex = new RegExp(`^${escapedPattern}$`);
      pathPatternRegexCache.set(pattern, regex);
    }

    const match = importPath.match(regex);

    if (match) {
      const mapping = mappings[0];
      if (!mapping) continue;

      let resolvedPath = mapping;
      for (let i = 1; i < match.length; i++) {
        resolvedPath = resolvedPath.replace("*", match[i]);
      }

      const fullPath = resolve(resolvedBaseUrl, resolvedPath);

      return fullPath;
    }
  }

  return importPath;
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
