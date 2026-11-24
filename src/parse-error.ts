import { ParseError } from "svelte-ast";

// One line, without svelte's link to its docs: the reason, then the line
// and column, e.g. `Unexpected token (2:13)`.
export function formatParseError(error: unknown): string {
  if (error instanceof ParseError) {
    return error.start ? `${error.reason} (${error.start.line}:${error.start.column})` : error.reason;
  }
  return error instanceof Error ? error.message : String(error);
}
