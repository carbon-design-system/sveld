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

export function clearConfigCache() {
  configCache.clear();
}

// Find nearest tsconfig.json/jsconfig.json starting from a directory
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

// Resolve a path alias to an absolute file system path for reading files.
// Returns the original path if it cannot be resolved.
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
    // Convert TS path pattern to regex
    // e.g., "$lib/*" -> /^\$lib\/(.*)$/
    // e.g., "$lib" -> /^\$lib$/
    // e.g., "@components/*" -> /^@components\/(.*)$/

    let regex = pathPatternRegexCache.get(pattern);
    if (!regex) {
      // Escape special regex chars but keep * for replacement
      const escapedPattern = pattern
        .split("*")
        .map((part) => part.replace(REGEX_SPECIAL_CHARS, "\\$&"))
        .join("(.*)");

      regex = new RegExp(`^${escapedPattern}$`);
      pathPatternRegexCache.set(pattern, regex);
    }

    const match = importPath.match(regex);

    if (match) {
      // Use the first mapping (TypeScript uses the first match)
      const mapping = mappings[0];
      if (!mapping) continue;

      // Replace * in mapping with captured groups
      let resolvedPath = mapping;
      for (let i = 1; i < match.length; i++) {
        resolvedPath = resolvedPath.replace("*", match[i]);
      }

      // Resolve relative to baseUrl
      const fullPath = resolve(resolvedBaseUrl, resolvedPath);

      return fullPath;
    }
  }

  return importPath;
}

// Resolve a path alias and convert to a relative path from fromDir.
// This is used for storing paths in the exports object for output generation.
// Returns the original path if it cannot be resolved.
export function resolvePathAlias(importPath: string, fromDir: string): string {
  if (importPath.startsWith(".") || importPath.startsWith("/")) {
    return importPath;
  }

  const absolutePath = resolvePathAliasAbsolute(importPath, fromDir);

  if (absolutePath === importPath) {
    return importPath;
  }

  let relativePath = relative(fromDir, absolutePath);

  // Normalize path separators to forward slashes for consistency across platforms
  relativePath = normalizeSeparators(relativePath);

  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}
