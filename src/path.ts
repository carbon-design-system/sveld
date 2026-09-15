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

/**
 * Same answer as `path.parse(filePath).ext === ".svelte"`, without building
 * the parse result: a leading dot is part of the name, so `.svelte` and
 * `dir/.svelte` have no extension.
 */
export function hasSvelteExtension(filePath: string): boolean {
  if (!filePath.endsWith(".svelte")) return false;
  const dot = filePath.length - ".svelte".length;
  if (dot === 0) return false;
  const before = filePath.charCodeAt(dot - 1);
  return before !== 47 /* / */ && (sep === "/" || before !== 92) /* \ */;
}

export function normalizeSeparators(filePath: string): NormalizedPath {
  return (sep === "/" ? filePath : filePath.split(sep).join("/")) as NormalizedPath;
}

export function normalizeComponentFilePath(filePath: string, inputDir: string): NormalizedPath {
  return normalizeSeparators(path.join(inputDir, path.normalize(filePath)));
}

export function formatJsonOutput(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}
