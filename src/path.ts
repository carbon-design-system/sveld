import { sep } from "path";

/**
 * Normalize directory separators to always use `/`.
 * @param filePath A file path.
 * @returns Path with normalized separators.
 */
export function normalizeSeparators(filePath: string) {
  return sep === "/" ? filePath : filePath.split(sep).join("/");
}
