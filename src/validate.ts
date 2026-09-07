import { isObject } from "./ast-guards";

export interface ParsedPackageJson {
  svelte?: string;
  name?: string;
  description?: string;
}

export function parsePackageJson(value: unknown): ParsedPackageJson {
  if (!isObject(value)) {
    return {};
  }

  const result: ParsedPackageJson = {};
  if (typeof value.svelte === "string") result.svelte = value.svelte;
  if (typeof value.name === "string") result.name = value.name;
  if (typeof value.description === "string") result.description = value.description;
  return result;
}

export interface ParsedTsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
  extends?: string;
}

export function parseTsConfig(value: unknown): ParsedTsConfig {
  if (!isObject(value)) {
    return {};
  }

  const result: ParsedTsConfig = {};

  if (typeof value.extends === "string") {
    result.extends = value.extends;
  }

  if (isObject(value.compilerOptions)) {
    const compilerOptions: NonNullable<ParsedTsConfig["compilerOptions"]> = {};

    if (typeof value.compilerOptions.baseUrl === "string") {
      compilerOptions.baseUrl = value.compilerOptions.baseUrl;
    }

    if (isObject(value.compilerOptions.paths)) {
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
