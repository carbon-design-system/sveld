/**
 * Splits a string on top-level commas, ignoring commas nested inside
 * `<>`, `()`, `[]`, `{}`, or a string literal. Shared by the `generics`
 * script attribute parser and the TypeScript definition writer, both of
 * which must separate generic constraint declarations that may themselves
 * contain commas (e.g. `Value extends Record<string, any>`). The `>` of an
 * arrow (`=>`) doesn't close a bracket.
 */
export function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '"' || char === "'" || char === "`") {
      i = skipStringLiteral(value, i);
    } else if (char === "<" || char === "(" || char === "[" || char === "{") depth++;
    else if (char === ">" && value[i - 1] === "=") continue;
    else if (char === ">" || char === ")" || char === "]" || char === "}") depth = Math.max(depth - 1, 0);
    else if (char === "," && depth === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }

  parts.push(value.slice(start));
  return parts;
}

/** Index of the quote closing the string literal that opens at `start`, or the last index if unclosed. */
function skipStringLiteral(value: string, start: number): number {
  const quote = value[start];
  for (let i = start + 1; i < value.length; i++) {
    if (value[i] === "\\") i++;
    else if (value[i] === quote) return i;
  }
  return value.length - 1;
}
