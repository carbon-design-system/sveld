const COMMENT_CLOSE_REGEX = /\*\//g;

/**
 * Makes text safe to place inside a generated `/** ... *\/` comment: a `*\/`
 * in a glob default (`"src/**\/*.js"`) or description would otherwise end
 * the comment early and break the `.d.ts`.
 */
export function escapeCommentText(text: string): string {
  return text.replace(COMMENT_CLOSE_REGEX, "*\\/");
}

export function assignValueOrUndefined(value?: "" | string) {
  return value === undefined || value === "" ? undefined : value;
}

const TEXT_COLLATOR = new Intl.Collator("en");

/**
 * Sort comparator for names in generated output. A fixed `en` collation (what `localeCompare()`
 * gives under en-US) keeps output identical across machines; plain `localeCompare()` follows the
 * machine's locale, so e.g. Czech sorts `change` after `hover` and breaks `--check` elsewhere.
 */
export function compareText(a: string, b: string): number {
  return TEXT_COLLATOR.compare(a, b);
}
