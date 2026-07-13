import path, { sep } from "node:path";
import type { NormalizedPath } from "./brands";

export function normalizeSeparators(filePath: string): NormalizedPath {
  return (sep === "/" ? filePath : filePath.split(sep).join("/")) as NormalizedPath;
}

export function normalizeComponentFilePath(filePath: string, inputDir: string): NormalizedPath {
  return normalizeSeparators(path.join(inputDir, path.normalize(filePath)));
}

export function formatJsonOutput(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}
