// Splits on `_` and on any run of characters that can't be in an
// identifier (`-`, `.`, `:`, `/`, `@`, whitespace), dropping them.
const CONTEXT_KEY_SPLIT_REGEX = /(?:_|[^\p{ID_Continue}$])+/u;
const IDENTIFIER_START_REGEX = /^[\p{ID_Start}$]/u;

// A key starting with a digit gets a leading `_` (`123` gives
// `_123Context`), since an identifier can't start with one.
export function generateContextTypeName(key: string): string {
  const parts = key.split(CONTEXT_KEY_SPLIT_REGEX);
  const capitalized = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  const typeName = `${capitalized}Context`;
  return IDENTIFIER_START_REGEX.test(typeName) ? typeName : `_${typeName}`;
}
