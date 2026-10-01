import { ParseError } from "sveast";

/**
 * A parse error as one line: the reason without svelte's link to its docs,
 * then the line and column, e.g. `Unexpected token (2:13)`.
 */
export function formatParseError(error: unknown): string {
  if (error instanceof ParseError) {
    return error.start ? `${error.reason} (${error.start.line}:${error.start.column})` : error.reason;
  }
  return error instanceof Error ? error.message : String(error);
}
