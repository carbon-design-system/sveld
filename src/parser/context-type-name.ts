/**
 * Split a `setContext` key for PascalCase naming on `_` and on any run of characters that can't
 * appear in an identifier (`-`, `.`, `:`, `/`, `@`, whitespace, ...), which also drops them.
 */
const CONTEXT_KEY_SPLIT_REGEX = /(?:_|[^\p{ID_Continue}$])+/u;
const IDENTIFIER_START_REGEX = /^[\p{ID_Start}$]/u;

/** Turn `simple-modal` into `SimpleModalContext`, `@scope/ctx` into `ScopeCtxContext`, and `123` into `_123Context`. */
export function generateContextTypeName(key: string): string {
  const parts = key.split(CONTEXT_KEY_SPLIT_REGEX);
  const capitalized = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  const typeName = `${capitalized}Context`;
  return IDENTIFIER_START_REGEX.test(typeName) ? typeName : `_${typeName}`;
}
