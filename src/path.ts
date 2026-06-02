import { sep } from "node:path";

/** Normalize path separators to `/`. */
export function normalizeSeparators(filePath: string) {
  return sep === "/" ? filePath : filePath.split(sep).join("/");
}
