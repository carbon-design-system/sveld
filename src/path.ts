import path, { sep } from "node:path";
import type { NormalizedPath } from "./brands";

/** Matches a trailing `.svelte` extension. Shared so every module tests/strips it the same way. */
export const SVELTE_EXT_REGEX = /\.svelte$/;

/**
 * Extensions the watch mode plugin hooks react to: components themselves,
 * the entry barrel (which may be `.js`/`.ts`), and `@extendProps`/`@extends`/
 * typedef `import(...)` dependency targets, which are never `.svelte`.
 */
export const WATCH_RELEVANT_EXT_REGEX = /\.(?:svelte|[mc]?ts|[mc]?js)$/;

export function normalizeSeparators(filePath: string): NormalizedPath {
  return (sep === "/" ? filePath : filePath.split(sep).join("/")) as NormalizedPath;
}

export function normalizeComponentFilePath(filePath: string, inputDir: string): NormalizedPath {
  return normalizeSeparators(path.join(inputDir, path.normalize(filePath)));
}

export function formatJsonOutput(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}
