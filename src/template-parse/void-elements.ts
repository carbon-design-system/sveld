/** HTML void element names and tag-name validation. From svelte's `src/utils.js`. */

const VOID_ELEMENT_NAMES = new Set([
  "area",
  "base",
  "br",
  "col",
  "command",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export function isVoidElement(name: string): boolean {
  // Gate the `toLowerCase()` allocation on the leading `!`; this runs per element.
  return VOID_ELEMENT_NAMES.has(name) || (name.charCodeAt(0) === 33 /* ! */ && name.toLowerCase() === "!doctype");
}

/**
 * Standard elements: ASCII alpha start, then ASCII alphanumerics.
 * Custom elements: ASCII alpha start, then PCENChar, with at least one hyphen
 * after the first character. Same source as svelte's `REGEX_VALID_TAG_NAME`
 * (`src/utils.js`), written as `\u`-escapes.
 */
const REGEX_VALID_TAG_NAME_SOURCE =
  "^[a-zA-Z][a-zA-Z0-9]*(-[a-zA-Z0-9.\\-_\\u00B7\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u203F-\\u2040\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}]*)?$";

const REGEX_VALID_TAG_NAME = new RegExp(REGEX_VALID_TAG_NAME_SOURCE, "u");

export function isValidTagName(name: string): boolean {
  return REGEX_VALID_TAG_NAME.test(name);
}
