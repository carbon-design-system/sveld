import { sep } from "node:path";
import type { NormalizedPath } from "./brands";

export function normalizeSeparators(filePath: string): NormalizedPath {
  return (sep === "/" ? filePath : filePath.split(sep).join("/")) as NormalizedPath;
}
