export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export interface ParsedPackageJson {
  svelte?: string;
}

export function parsePackageJson(value: unknown): ParsedPackageJson {
  if (!isRecord(value)) {
    return {};
  }

  const svelte = value.svelte;
  return typeof svelte === "string" ? { svelte } : {};
}

export interface ParsedTsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
  extends?: string;
}

export function parseTsConfig(value: unknown): ParsedTsConfig {
  if (!isRecord(value)) {
    return {};
  }

  const result: ParsedTsConfig = {};

  if (typeof value.extends === "string") {
    result.extends = value.extends;
  }

  if (isRecord(value.compilerOptions)) {
    const compilerOptions: NonNullable<ParsedTsConfig["compilerOptions"]> = {};

    if (typeof value.compilerOptions.baseUrl === "string") {
      compilerOptions.baseUrl = value.compilerOptions.baseUrl;
    }

    if (isRecord(value.compilerOptions.paths)) {
      const paths: Record<string, string[]> = {};
      for (const [key, mappings] of Object.entries(value.compilerOptions.paths)) {
        if (Array.isArray(mappings) && mappings.every((entry) => typeof entry === "string")) {
          paths[key] = mappings;
        }
      }
      if (Object.keys(paths).length > 0) {
        compilerOptions.paths = paths;
      }
    }

    if (Object.keys(compilerOptions).length > 0) {
      result.compilerOptions = compilerOptions;
    }
  }

  return result;
}
