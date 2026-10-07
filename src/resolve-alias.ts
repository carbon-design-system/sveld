import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { MODULE_EXTENSIONS, normalizeSeparators } from "./path";
import { type ParsedTsConfig, parseTsConfig } from "./validate";

const pathPatternRegexCache = new Map<string, RegExp>();

const COMMENT_PATTERN = /\/\*[\s\S]*?\*\/|\/\/.*/g;
const REGEX_SPECIAL_CHARS = /[.+?^${}()|[\]\\]/g;

const ALIAS_CANDIDATE_EXTENSIONS = [".svelte", ...MODULE_EXTENSIONS];

/** A re-export source or path alias that doesn't resolve to a file on disk. */
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

function pathAliasTargetExists(fullPath: string): boolean {
  if (existsSync(fullPath)) return true;
  return ALIAS_CANDIDATE_EXTENSIONS.some((ext) => existsSync(fullPath + ext));
}

function patternPrefixLength(pattern: string): number {
  const wildcardIndex = pattern.indexOf("*");
  return wildcardIndex === -1 ? pattern.length : wildcardIndex;
}

function findConfig(startDir: string): string | null {
  let dir = startDir;
  const root = resolve(dir, "/");

  while (dir !== root) {
    for (const configName of ["tsconfig.json", "jsconfig.json"]) {
      const configPath = join(dir, configName);
      if (existsSync(configPath)) return configPath;
    }
    dir = dirname(dir);
  }

  return null;
}

function parseConfig(configPath: string, configCache: Map<string, ParsedTsConfig | null>): ParsedTsConfig | null {
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
    const config = parseTsConfig(parsed);

    if (config.extends) {
      const baseConfigPath = isAbsolute(config.extends) ? config.extends : resolve(dirname(configPath), config.extends);
      const fullBaseConfigPath = baseConfigPath.endsWith(".json") ? baseConfigPath : `${baseConfigPath}.json`;

      if (existsSync(fullBaseConfigPath)) {
        const baseConfig = parseConfig(fullBaseConfigPath, configCache);
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

interface AliasLookup {
  /** Absolute path when resolved via an alias mapping; `importPath` unchanged otherwise. */
  resolved: string;
  /** True when `importPath` is a non-relative specifier that no `paths` entry matched. */
  unresolved: boolean;
  /** What was searched, for error messages. */
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

/** Resolves tsconfig/jsconfig `paths` aliases, reading each config file once per instance. */
export class PathAliases {
  private readonly configs = new Map<string, ParsedTsConfig | null>();

  /**
   * Patterns are tried longest literal prefix first (like `tsc`), not in JSON
   * key order. Within the matched pattern the first mapping that exists on
   * disk wins; if none does, the first mapping is a best-effort guess.
   */
  lookup(importPath: string, fromDir: string): AliasLookup {
    if (importPath.startsWith(".") || importPath.startsWith("/")) {
      return { resolved: importPath, unresolved: false, searched: "" };
    }

    const configPath = findConfig(fromDir);
    const compilerOptions = configPath ? parseConfig(configPath, this.configs)?.compilerOptions : undefined;
    const paths = compilerOptions?.paths;
    if (!configPath || !compilerOptions || !paths) {
      return { resolved: importPath, unresolved: true, searched: "no tsconfig/jsconfig paths found" };
    }

    const resolvedBaseUrl = resolve(dirname(configPath), compilerOptions.baseUrl ?? ".");
    const patterns = Object.entries(paths).sort(([a], [b]) => patternPrefixLength(b) - patternPrefixLength(a));

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
        firstCandidate ??= fullPath;
        if (pathAliasTargetExists(fullPath)) {
          return { resolved: fullPath, unresolved: false, searched: configPath };
        }
      }

      return { resolved: firstCandidate ?? importPath, unresolved: false, searched: configPath };
    }

    return { resolved: importPath, unresolved: true, searched: `tsconfig paths (${configPath})` };
  }

  /** `$lib/utils` -> `/abs/src/lib/utils`; a non-alias comes back unchanged. */
  absolute(importPath: string, fromDir: string): string {
    return this.lookup(importPath, fromDir).resolved;
  }

  /** Like {@link absolute}, but relative to `fromDir` (`./lib/utils`), for generated exports. */
  relative(importPath: string, fromDir: string): string {
    const absolutePath = this.absolute(importPath, fromDir);
    if (absolutePath === importPath) return importPath;
    const relativePath = normalizeSeparators(relative(fromDir, absolutePath));
    return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
  }
}
