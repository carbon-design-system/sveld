// invariant: the scanning helpers for TypeScript type text
// (`{ a: Map<string, () => void> }`, `"x" | "y"`, ...) share these rules:
// - `<>`, `()`, `[]` and `{}` nest, and a closer never takes the depth
//   below 0;
// - the `>` of an arrow (`=>`) is not a closer;
// - string and template literals (`"`, `'`, `` ` ``, with `\` escapes)
//   are skipped whole, so brackets and separators inside them don't count.

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

const WHITESPACE_REGEX = /\s/;

/** Return `true` to stop the scan at `index`. */
type TypeTextVisitor = (index: number, depth: number) => boolean | undefined;

// `depth` already includes the visited character: an opener reports its
// inner depth, a closer the depth it returns to. A character inside a
// string literal is never visited. Stops early when `visit` returns
// `true`, and returns the depth where the scan stopped.
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

// Gives `end - 1` when the literal never closes.
function skipStringLiteral(text: string, start: number, end: number): number {
  const quote = text.charCodeAt(start);
  for (let i = start + 1; i < end; i++) {
    const c = text.charCodeAt(i);
    if (c === CH_BACKSLASH) i++;
    else if (c === quote) return i;
  }
  return end - 1;
}

// Parts are never trimmed.
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

function findIndex(text: string, matches: (index: number, depth: number) => boolean, start = 0): number {
  let found = -1;
  scanTypeText(
    text,
    (index, depth) => {
      if (matches(index, depth)) found = index;
      return found !== -1;
    },
    start,
  );
  return found;
}

export function indexOfTopLevel(text: string, chars: string): number {
  return findIndex(text, (index, depth) => depth === 0 && chars.includes(text[index]));
}

// Gives the index of the `=` of `=>`, never the `>`.
export function indexOfTopLevelArrow(text: string): number {
  return findIndex(text, (index, depth) => depth === 0 && text[index] === "=" && text[index + 1] === ">");
}

export function indexOfClosingBracket(text: string, openIndex: number): number {
  return findIndex(text, (_index, depth) => depth === 0, openIndex);
}

// An array of tuples (`[A, B][]`) isn't a tuple type.
export function isTupleType(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("[") && indexOfClosingBracket(trimmed, 0) === trimmed.length - 1;
}

// Splits at the first top-level arrow, so `(a: A) => () => B`
// gives `() => B`.
export function returnTypeOfFunctionType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const arrowIndex = indexOfTopLevelArrow(type);
  if (arrowIndex === -1) return undefined;
  return type.slice(arrowIndex + 2).trim() || undefined;
}

// A union can add these to a callback type without making it something
// else to call.
const NULLISH_TYPES = new Set(["null", "undefined"]);

// A union with `null`/`undefined` (`(() => void) | undefined`) still
// counts; an object type with a callback member doesn't.
export function isFunctionType(type: string | undefined): boolean {
  if (!type) return false;
  const members = splitTopLevel(type, "|")
    .map((member) => member.trim())
    .filter((member) => member && !NULLISH_TYPES.has(member));
  if (members.length !== 1) return false;
  const member = unwrapParens(members[0]);
  return (member.startsWith("(") || member.startsWith("<")) && indexOfTopLevelArrow(member) !== -1;
}

// Comments go and every whitespace run outside a string literal collapses
// to one space, so a change in layout or doc comments compares equal.
export function normalizeTypeText(text: string): string {
  let result = "";
  // A comment or whitespace run becomes one space, written only before the
  // next token.
  let pendingSpace = false;
  const emit = (token: string) => {
    if (pendingSpace && result !== "") result += " ";
    pendingSpace = false;
    result += token;
  };
  let i = 0;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (c === CH_DOUBLE_QUOTE || c === CH_SINGLE_QUOTE || c === CH_BACKTICK) {
      const close = skipStringLiteral(text, i, text.length);
      emit(text.slice(i, close + 1));
      i = close + 1;
    } else if (text.startsWith("/*", i)) {
      const close = text.indexOf("*/", i + 2);
      i = close === -1 ? text.length : close + 2;
      pendingSpace = true;
    } else if (text.startsWith("//", i)) {
      const close = text.indexOf("\n", i + 2);
      i = close === -1 ? text.length : close + 1;
      pendingSpace = true;
    } else if (WHITESPACE_REGEX.test(text[i])) {
      pendingSpace = true;
      i++;
    } else {
      emit(text[i]);
      i++;
    }
  }
  return result;
}

export function unwrapParens(text: string): string {
  let result = text.trim();
  while (result.startsWith("(") && indexOfClosingBracket(result, 0) === result.length - 1) {
    result = result.slice(1, -1).trim();
  }
  return result;
}
