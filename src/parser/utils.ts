/** Each `*\/`, which would close a block comment. */
const COMMENT_CLOSE_REGEX = /\*\//g;
const REGEX_SPECIAL_CHARS_REGEX = /[.*+?^${}()|[\]\\]/g;

/** `text` matched literally inside a `RegExp`. */
export function escapeRegExp(text: string): string {
  return text.replace(REGEX_SPECIAL_CHARS_REGEX, "\\$&");
}

/**
 * Makes text safe to place inside a generated `/** ... *\/` comment: a `*\/`
 * in a glob default (`"src/**\/*.js"`) or description would otherwise end
 * the comment early and break the `.d.ts`.
 */
export function escapeCommentText(text: string): string {
  return text.replace(COMMENT_CLOSE_REGEX, "*\\/");
}

/** `a: string, b?: number` */
export function formatParamList(params: Array<{ name: string; type: string; optional?: boolean }>): string {
  return params.map((param) => `${param.name}${param.optional ? "?" : ""}: ${param.type}`).join(", ");
}

/** Created on first use: creating a collator takes milliseconds, and most runs that load this never sort. */
let textCollator: Intl.Collator | undefined;

/**
 * Sort comparator for names in generated output. A fixed `en` collation (what `localeCompare()`
 * gives under en-US) keeps output identical across machines; plain `localeCompare()` follows the
 * machine's locale, so e.g. Czech sorts `change` after `hover` and breaks `--check` elsewhere.
 */
export function compareText(a: string, b: string): number {
  textCollator ??= new Intl.Collator("en");
  return textCollator.compare(a, b);
}
