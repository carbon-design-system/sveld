/** Characters that need escaping when dropped literally into a `RegExp` source string. */
const REGEXP_SPECIAL_CHARS = ".+^${}()|[]\\";

/**
 * Minimal glob matcher for `diagnostics.ignore[].component` patterns: `*`
 * matches within a path segment, `**` matches across segments (including an
 * optional following `/`), and `?` matches one character. No dependency on a
 * glob library; sveld ships no runtime dependencies.
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

/** True when `value` matches the glob `pattern` (see {@link globToRegExpSource} for supported syntax). */
export function matchesGlob(pattern: string, value: string): boolean {
  return new RegExp(`^${globToRegExpSource(pattern)}$`).test(value);
}
