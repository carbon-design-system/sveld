import path, { sep } from "node:path";
import type { NormalizedPath } from "./brands";

export const SVELTE_EXT_REGEX = /\.svelte$/;

/** Probed in order for a specifier without an extension and for a directory's `index` file. */
export const MODULE_EXTENSIONS: readonly string[] = [
  ".ts",
  ".mts",
  ".cts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".d.ts",
];

/** Components, the entry barrel, imported modules, and `@extends` targets. */
export const WATCH_RELEVANT_EXT_REGEX = /\.(?:svelte|[mc]?ts|[mc]?js|tsx|jsx)$/;

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
