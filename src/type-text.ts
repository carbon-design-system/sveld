/**
 * Scanning helpers for TypeScript type text (`{ a: Map<string, () => void> }`,
 * `"x" | "y"`, ...). Every helper follows the same rules:
 * - `<>`, `()`, `[]` and `{}` nest, and a closer never takes the depth below 0;
 * - the `>` of an arrow (`=>`) is not a closer;
 * - string and template literals (`"`, `'`, `` ` ``, with `\` escapes) are
 *   skipped whole, so brackets and separators inside them don't count.
 */

const CH_DOUBLE_QUOTE = 34;
const CH_SINGLE_QUOTE = 39;
const CH_OPEN_PAREN = 40;
const CH_CLOSE_PAREN = 41;
const CH_LT = 60;
const CH_EQUALS = 61;
const CH_GT = 62;
const CH_OPEN_BRACKET = 91;
const CH_BACKSLASH = 92;
const CH_CLOSE_BRACKET = 93;
const CH_BACKTICK = 96;
const CH_OPEN_BRACE = 123;
const CH_CLOSE_BRACE = 125;

/** Return `true` to stop the scan at `index`. */
type TypeTextVisitor = (index: number, depth: number) => boolean | undefined;

/**
 * Walks `text[start, end)` from bracket depth `initialDepth`, calling `visit(index,
 * depth)` for every character outside a string literal, where `depth` already
 * includes that character (an opener reports its inner depth, a closer the
 * depth it returns to). Stops early when `visit` returns `true`. Returns the
 * depth at the point the scan stopped.
 */
export function scanTypeText(
  text: string,
  visit?: TypeTextVisitor,
  start = 0,
  end = text.length,
  initialDepth = 0,
): number {
  let depth = initialDepth;
  for (let i = start; i < end; i++) {
    const c = text.charCodeAt(i);

    if (c === CH_DOUBLE_QUOTE || c === CH_SINGLE_QUOTE || c === CH_BACKTICK) {
      i = skipStringLiteral(text, i, end);
      continue;
    }

    if (c === CH_OPEN_BRACE || c === CH_OPEN_PAREN || c === CH_OPEN_BRACKET || c === CH_LT) depth++;
    else if (
      c === CH_CLOSE_BRACE ||
      c === CH_CLOSE_PAREN ||
      c === CH_CLOSE_BRACKET ||
      (c === CH_GT && text.charCodeAt(i - 1) !== CH_EQUALS)
    ) {
      if (depth > 0) depth--;
    }

    if (visit?.(i, depth) === true) break;
  }
  return depth;
}

/** Index of the quote closing the string literal that opens at `start`, or `end - 1` if unclosed. */
function skipStringLiteral(text: string, start: number, end: number): number {
  const quote = text.charCodeAt(start);
  for (let i = start + 1; i < end; i++) {
    const c = text.charCodeAt(i);
    if (c === CH_BACKSLASH) i++;
    else if (c === quote) return i;
  }
  return end - 1;
}

/** Splits `text` on every top-level character in `separators` (e.g. `","` or `";,"`). Parts are not trimmed. */
export function splitTopLevel(text: string, separators: string): string[] {
  const parts: string[] = [];
  let partStart = 0;
  scanTypeText(text, (index, depth) => {
    if (depth === 0 && separators.includes(text[index])) {
      parts.push(text.slice(partStart, index));
      partStart = index + 1;
    }
    return false;
  });
  parts.push(text.slice(partStart));
  return parts;
}

/** Index of the first top-level character in `chars`, or -1. */
export function indexOfTopLevel(text: string, chars: string): number {
  let found = -1;
  scanTypeText(text, (index, depth) => {
    if (depth === 0 && chars.includes(text[index])) found = index;
    return found !== -1;
  });
  return found;
}

/** Index of the `=` of the first top-level `=>`, or -1. */
export function indexOfTopLevelArrow(text: string): number {
  let found = -1;
  scanTypeText(text, (index, depth) => {
    if (depth === 0 && text[index] === "=" && text[index + 1] === ">") found = index;
    return found !== -1;
  });
  return found;
}

/** Index of the bracket closing the one at `openIndex`, or -1 when it never closes. */
export function indexOfClosingBracket(text: string, openIndex: number): number {
  let found = -1;
  scanTypeText(
    text,
    (index, depth) => {
      if (depth === 0) found = index;
      return found !== -1;
    },
    openIndex,
  );
  return found;
}

/** Whether `text` is a tuple type (`[A, B]`), not an array of one (`[A, B][]`). */
export function isTupleType(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("[") && indexOfClosingBracket(trimmed, 0) === trimmed.length - 1;
}

/** Return type of a function type (`(a: A) => () => B` gives `() => B`), or `undefined` without a top-level arrow. */
export function returnTypeOfFunctionType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const arrowIndex = indexOfTopLevelArrow(type);
  if (arrowIndex === -1) return undefined;
  return type.slice(arrowIndex + 2).trim() || undefined;
}
