const REGEXP_SPECIAL_CHARS = ".+^$()[]{}|\\";

/**
 * For `diagnostics.ignore[].component`: `*` matches within a path segment,
 * `**` across segments (eating a following `/`), `?` one character. Hand-rolled
 * since sveld ships no runtime dependencies.
 */
function globToRegExpSource(pattern: string): string {
  let source = "";

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];

    if (ch === "*" && pattern[i + 1] === "*") {
      source += ".*";
      i++;
      if (pattern[i + 1] === "/") i++;
      continue;
    }

    if (ch === "*") {
      source += "[^/]*";
      continue;
    }

    if (ch === "?") {
      source += "[^/]";
      continue;
    }

    source += REGEXP_SPECIAL_CHARS.includes(ch) ? `\\${ch}` : ch;
  }

  return source;
}

export function matchesGlob(pattern: string, value: string): boolean {
  return new RegExp(`^${globToRegExpSource(pattern)}$`).test(value);
}
