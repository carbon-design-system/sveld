const COMMENT_CLOSE_REGEX = /\*\//g;
const REGEX_SPECIAL_CHARS_REGEX = /[.*+?^${}()|[\]\\]/g;

export function escapeRegExp(text: string): string {
  return text.replace(REGEX_SPECIAL_CHARS_REGEX, "\\$&");
}

// A `*/` in a glob default (`"src/**/*.js"`) or description would
// otherwise end a generated comment early and break the `.d.ts`.
export function escapeCommentText(text: string): string {
  return text.replace(COMMENT_CLOSE_REGEX, "*\\/");
}

export function formatParamList(params: Array<{ name: string; type: string; optional?: boolean }>): string {
  return params.map((param) => `${param.name}${param.optional ? "?" : ""}: ${param.type}`).join(", ");
}

// perf: created on first use, since creating a collator takes
// milliseconds and most runs that load this never sort.
let textCollator: Intl.Collator | undefined;

// A fixed `en` collation (what `localeCompare()` gives under en-US)
// keeps output identical across machines; plain `localeCompare()`
// follows the machine's locale, so Czech sorts `change` after `hover`
// and breaks `--check` elsewhere.
export function compareText(a: string, b: string): number {
  textCollator ??= new Intl.Collator("en");
  return textCollator.compare(a, b);
}

// What `/\w/` matches without the `u` flag, so `containsWord` draws its
// boundaries where `\b` would.
function isWordCode(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95;
}

// Matches what `new RegExp(`\\b${escapeRegExp(word)}\\b`).test(text)`
// does, without building a regex for each word.
export function containsWord(text: string, word: string): boolean {
  if (word === "") {
    // `\b\b` matches at any boundary, so any word character will do.
    for (let at = 0; at < text.length; at++) if (isWordCode(text.charCodeAt(at))) return true;
    return false;
  }
  const startsWord = isWordCode(word.charCodeAt(0));
  const endsWord = isWordCode(word.charCodeAt(word.length - 1));
  for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
    const before = at > 0 && isWordCode(text.charCodeAt(at - 1));
    const after = at + word.length < text.length && isWordCode(text.charCodeAt(at + word.length));
    if (before !== startsWord && after !== endsWord) return true;
  }
  return false;
}
