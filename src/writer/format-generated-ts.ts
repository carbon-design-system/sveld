import { scanTypeText } from "../type-text";

const INDENT_UNIT = "  ";
// Conservative width for collapsing `{...}` onto one line; ignores surrounding indent.
const INLINE_WIDTH_BUDGET = 120;
// `interface` bodies always expand, unlike plain `{...}` type literals.
const INTERFACE_HEADER_REGEX = /\binterface\s+[A-Za-z_$][\w$]*(\s*<[^{};]*>)?\s*$/;
const INTERFACE_HEADER_TAIL_LENGTH = 200;
const WHITESPACE_CHAR_REGEX = /\s/;
const NEEDS_FLATTEN_REGEX = /\s{2}|[^\S ]/;

// Scanners jump between hits via `lastIndex` instead of testing every char in JS;
// `test` (not `exec`) avoids allocating a match array.
const BRACE_SCAN_REGEX = /["'`{}/]/g;
const STATEMENT_SCAN_REGEX = /["'`{};/]/g;

// Char codes, so hot loops compare numbers instead of allocating one-char strings.
const CH_TAB = 9;
const CH_LF = 10;
const CH_CR = 13;
const CH_SPACE = 32;
const CH_DOUBLE_QUOTE = 34;
const CH_AMPERSAND = 38;
const CH_SINGLE_QUOTE = 39;
const CH_OPEN_PAREN = 40;
const CH_CLOSE_PAREN = 41;
const CH_STAR = 42;
const CH_DOT = 46;
const CH_SLASH = 47;
const CH_SEMICOLON = 59;
const CH_GT = 62;
const CH_OPEN_BRACKET = 91;
const CH_BACKSLASH = 92;
const CH_CLOSE_BRACKET = 93;
const CH_BACKTICK = 96;
const CH_OPEN_BRACE = 123;
const CH_PIPE = 124;
const CH_CLOSE_BRACE = 125;

function endsWithInterfaceHeader(out: string[]): boolean {
  return INTERFACE_HEADER_REGEX.test(tailString(out, INTERFACE_HEADER_TAIL_LENGTH));
}

const indentCache: string[] = [""];

function indentString(depth: number): string {
  let indent = indentCache[depth];
  if (indent === undefined) {
    indent = INDENT_UNIT.repeat(depth);
    indentCache[depth] = indent;
  }
  return indent;
}

// Avoids joining the whole (potentially huge) buffer just to read its tail.
function tailString(out: string[], maxLen: number): string {
  let result = "";
  for (let i = out.length - 1; i >= 0 && result.length < maxLen; i--) {
    result = out[i] + result;
  }
  return result.length > maxLen ? result.slice(-maxLen) : result;
}

function endsWithNewline(out: string[]): boolean {
  if (out.length === 0) return false;
  const last = out[out.length - 1];
  return last.charCodeAt(last.length - 1) === CH_LF;
}

function popTrailingSpacesAndTabs(out: string[]): void {
  while (out.length > 0) {
    const last = out[out.length - 1];
    let end = last.length;
    while (end > 0) {
      const c = last.charCodeAt(end - 1);
      if (c !== CH_SPACE && c !== CH_TAB) break;
      end--;
    }
    if (end === last.length) return;
    if (end === 0) {
      out.pop();
      continue;
    }
    out[out.length - 1] = last.slice(0, end);
    return;
  }
}

function popTrailingWhitespace(out: string[]): void {
  while (out.length > 0) {
    const last = out[out.length - 1];
    // Common case; skips the `trimEnd` copy.
    if (!WHITESPACE_CHAR_REGEX.test(last[last.length - 1])) return;
    const trimmed = last.trimEnd();
    if (trimmed.length === last.length) return;
    if (trimmed.length === 0) {
      out.pop();
      continue;
    }
    out[out.length - 1] = trimmed;
    return;
  }
}

/**
 * Fast path for the `{...}` collapse decision: with no nested `{` (whose collapse
 * could change the outer decision), 2+ `;` outside quotes always expands, so the
 * speculative recursive expansion can be skipped. One `;` may still collapse.
 */
function hasMultipleFlatStatements(content: string): boolean {
  if (content.includes("{")) return false;

  let quote = 0;
  let semicolons = 0;

  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i);

    if (quote !== 0) {
      if (c === quote && content.charCodeAt(i - 1) !== CH_BACKSLASH) quote = 0;
      continue;
    }

    if (c === CH_DOUBLE_QUOTE || c === CH_SINGLE_QUOTE || c === CH_BACKTICK) {
      quote = c;
      continue;
    }

    if (c === CH_SEMICOLON && ++semicolons >= 2) return true;
  }

  return false;
}

/** Collapses whitespace runs outside quotes to a single space and trims the end. */
function flattenToOneLine(content: string): string {
  if (!NEEDS_FLATTEN_REGEX.test(content)) return content.trimEnd();

  let out = "";
  let quote: "double" | "single" | "template" | null = null;
  let lastWasSpace = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const prev = content[i - 1];

    if (quote) {
      out += c;
      if (
        (quote === "double" && c === '"' && prev !== "\\") ||
        (quote === "single" && c === "'" && prev !== "\\") ||
        (quote === "template" && c === "`" && prev !== "\\")
      ) {
        quote = null;
      }
      lastWasSpace = false;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      quote = c === '"' ? "double" : c === "'" ? "single" : "template";
      out += c;
      lastWasSpace = false;
      continue;
    }

    if (WHITESPACE_CHAR_REGEX.test(c)) {
      if (!lastWasSpace && out.length > 0) {
        out += " ";
        lastWasSpace = true;
      }
      continue;
    }

    out += c;
    lastWasSpace = false;
  }

  return out.trimEnd();
}

/** Index of the closing quote, or -1. Any quote preceded by a backslash doesn't close, even after `\\`. */
function findStringClose(raw: string, open: number): number {
  const quote = raw[open];
  let at = raw.indexOf(quote, open + 1);
  while (at !== -1 && raw.charCodeAt(at - 1) === CH_BACKSLASH) {
    at = raw.indexOf(quote, at + 1);
  }
  return at;
}

/** Index of the closing `/`, or -1. `/*` followed straight by `/` closes immediately. */
function findBlockCommentClose(raw: string, open: number): number {
  const at = raw.indexOf("*/", open + 1);
  return at === -1 ? -1 : at + 1;
}

/**
 * Maps each `{` outside strings/block comments to its matching `}` in one pass
 * (a per-`{` scan re-walks nested blocks per level). A sparse Map beats a
 * `raw.length`-sized table that must be allocated on every call.
 */
function computeBraceMatches(raw: string): Map<number, number> {
  const matches = new Map<number, number>();
  const stack: number[] = [];
  const scan = BRACE_SCAN_REGEX;
  let i = 0;

  while (i < raw.length) {
    scan.lastIndex = i;
    if (!scan.test(raw)) break;
    i = scan.lastIndex - 1;
    const c = raw.charCodeAt(i);

    if (c === CH_SLASH) {
      if (raw.charCodeAt(i + 1) === CH_STAR) {
        const close = findBlockCommentClose(raw, i);
        if (close === -1) break;
        i = close;
      }
    } else if (c === CH_DOUBLE_QUOTE || c === CH_SINGLE_QUOTE || c === CH_BACKTICK) {
      const close = findStringClose(raw, i);
      if (close === -1) break;
      i = close;
    } else if (c === CH_OPEN_BRACE) {
      stack.push(i);
    } else if (c === CH_CLOSE_BRACE && stack.length > 0) {
      matches.set(stack.pop() as number, i);
    }

    i++;
  }

  return matches;
}

/** `raw.slice(from, to).trim() === ""` without the copy. */
function isBlankRange(raw: string, from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    if (!isTrimmedWhitespace(raw.charCodeAt(i))) return false;
  }
  return true;
}

/** Whether `String.prototype.trim` would strip this code unit. */
function isTrimmedWhitespace(code: number): boolean {
  if (code <= CH_SPACE) return code === CH_SPACE || (code >= CH_TAB && code <= CH_CR);
  if (code < 0xa0) return false;
  return (
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

/**
 * Breaks template output onto statement lines (after `{`, before `}`, after `;`)
 * for the reindent pass, skipping string and comment contents. Short `{...}`
 * blocks collapse onto one line within `INLINE_WIDTH_BUDGET`; interface bodies
 * always expand. Works on `raw[from, to)` so nested blocks recurse without slicing.
 */
function expandRange(raw: string, from: number, to: number, matches: Map<number, number>): string {
  const out: string[] = [];
  const scan = STATEMENT_SCAN_REGEX;
  let runStart = from;
  let i = from;

  while (i < to) {
    scan.lastIndex = i;
    if (!scan.test(raw)) break;
    i = scan.lastIndex - 1;
    if (i >= to) break;
    const c = raw.charCodeAt(i);

    if (c === CH_SLASH) {
      if (raw.charCodeAt(i + 1) === CH_STAR) {
        const close = findBlockCommentClose(raw, i);
        if (close === -1) break;
        i = close;
      }
      i++;
      continue;
    }

    if (c === CH_DOUBLE_QUOTE || c === CH_SINGLE_QUOTE || c === CH_BACKTICK) {
      const close = findStringClose(raw, i);
      if (close === -1) break;
      i = close + 1;
      continue;
    }

    if (c === CH_OPEN_BRACE) {
      const closeIndex = matches.get(i);
      // Unmatched: copy the brace through as ordinary text.
      if (closeIndex === undefined || closeIndex >= to) {
        i++;
        continue;
      }

      if (runStart < i) out.push(raw.slice(runStart, i));
      const contentStart = i + 1;

      if (isBlankRange(raw, contentStart, closeIndex)) {
        out.push("{}");
        i = closeIndex + 1;
        runStart = i;
        continue;
      }

      const content = raw.slice(contentStart, closeIndex);
      const nextIsNewline = raw.charCodeAt(contentStart) === CH_LF;

      if (
        !nextIsNewline &&
        !content.includes("/*") &&
        !hasMultipleFlatStatements(content) &&
        !endsWithInterfaceHeader(out)
      ) {
        const inner = expandRange(raw, contentStart, closeIndex, matches);
        const normalized = inner.trim();
        if (!normalized.includes("\n")) {
          const body = normalized.endsWith(";") ? normalized.slice(0, -1) : normalized;
          const candidate = `{ ${flattenToOneLine(body)} }`;
          if (candidate.length <= INLINE_WIDTH_BUDGET) {
            out.push(candidate);
            i = closeIndex + 1;
            runStart = i;
            continue;
          }
        }

        // Stays expanded: reuse the recursive pass instead of rescanning `content`.
        // A leading `;` would have consumed the newline after `{`.
        out.push("{");
        if (inner.charCodeAt(0) !== CH_SEMICOLON) out.push("\n");
        if (inner.length > 0) out.push(inner);
        i = closeIndex;
        runStart = closeIndex;
        continue;
      }

      out.push("{");
      if (!nextIsNewline) out.push("\n");
      i = contentStart;
      runStart = contentStart;
      continue;
    }

    if (c === CH_CLOSE_BRACE) {
      if (runStart < i) out.push(raw.slice(runStart, i));
      popTrailingSpacesAndTabs(out);
      if (!endsWithNewline(out)) out.push("\n");
      out.push("}");
      i++;
      runStart = i;
      continue;
    }

    // c === CH_SEMICOLON. Templates sometimes leave blank lines before it; attach it.
    if (runStart < i) out.push(raw.slice(runStart, i));
    popTrailingWhitespace(out);
    out.push(";");
    if (raw.charCodeAt(i + 1) !== CH_LF) out.push("\n");
    i++;
    runStart = i;
  }

  if (runStart < to) out.push(raw.slice(runStart, to));
  return out.join("");
}

/** Collapses runs of spaces outside quotes to a single space. */
function collapseSpaces(line: string): string {
  if (!line.includes("  ")) return line;

  let out = "";
  let quote = 0;

  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);

    if (quote !== 0) {
      out += line[i];
      if (c === quote && line.charCodeAt(i - 1) !== CH_BACKSLASH) quote = 0;
      continue;
    }

    if (c === CH_DOUBLE_QUOTE || c === CH_SINGLE_QUOTE || c === CH_BACKTICK) {
      quote = c;
      out += line[i];
      continue;
    }

    if (c === CH_SPACE && out.charCodeAt(out.length - 1) === CH_SPACE) continue;
    out += line[i];
  }

  return out;
}

function isCloserCode(code: number): boolean {
  return code === CH_CLOSE_BRACE || code === CH_CLOSE_BRACKET || code === CH_CLOSE_PAREN || code === CH_GT;
}

function startsWithDocOpen(text: string, at: number, end: number): boolean {
  return (
    end - at >= 3 &&
    text.charCodeAt(at) === CH_SLASH &&
    text.charCodeAt(at + 1) === CH_STAR &&
    text.charCodeAt(at + 2) === CH_STAR
  );
}

function containsDocClose(text: string, at: number, end: number): boolean {
  const found = text.indexOf("*/", at);
  return found !== -1 && found + 2 <= end;
}

/**
 * A wrapped union/intersection member (`| "b"`, `& B`) or member access (`.Foo`,
 * not a `...` spread) from a multi-line JSDoc `{type}`; indented one level deeper.
 */
function continuesExpression(text: string, at: number, end: number): boolean {
  const c = text.charCodeAt(at);
  if (c === CH_PIPE || c === CH_AMPERSAND) return true;
  return c === CH_DOT && at + 1 < end && text.charCodeAt(at + 1) !== CH_DOT;
}

/**
 * Reindents by bracket depth, ignoring block comments (`{@link Foo}` must not
 * move the depth), and normalizes blank lines: runs collapse to one, and blank
 * lines after an opener, before a top-level closer, or at the end are dropped.
 *
 * Indent and content stay in separate arrays until the final join: concatenating
 * per line left ropes that the next `charCodeAt` had to flatten, costing more
 * than the reindent itself.
 */
function reindentAndTidy(text: string): string {
  // Parallel arrays: one entry per emitted line. A blank line is `""` with indent 0.
  const outIndent: number[] = [];
  const outContent: string[] = [];
  const length = text.length;
  let depth = 0;
  let inBlockComment = false;
  let commentIndent = 0;
  let lineStart = 0;

  while (lineStart <= length) {
    let lineEnd = text.indexOf("\n", lineStart);
    if (lineEnd === -1) lineEnd = length;
    const nextLineStart = lineEnd + 1;

    let start = lineStart;
    let end = lineEnd;
    while (start < end && isTrimmedWhitespace(text.charCodeAt(start))) start++;
    while (end > start && isTrimmedWhitespace(text.charCodeAt(end - 1))) end--;

    if (start === end) {
      const prev = outContent.length > 0 ? outContent[outContent.length - 1] : undefined;
      // First line, or already following a blank line: nothing to add.
      if (prev !== undefined && prev !== "") {
        const prevLast = prev.charCodeAt(prev.length - 1);
        if (prevLast !== CH_OPEN_BRACE && prevLast !== CH_OPEN_PAREN && prevLast !== CH_OPEN_BRACKET) {
          outIndent.push(0);
          outContent.push("");
        }
      }
      lineStart = nextLineStart;
      continue;
    }

    if (inBlockComment) {
      // One extra space aligns `*` under the opening `/**`. Internal spacing is
      // kept: bodies may hold authored code examples with meaningful whitespace.
      outIndent.push(commentIndent);
      outContent.push(` ${text.slice(start, end)}`);
      if (containsDocClose(text, start, end)) inBlockComment = false;
      lineStart = nextLineStart;
      continue;
    }

    const isDocOpen = startsWithDocOpen(text, start, end);
    const hasDocClose = isDocOpen && containsDocClose(text, start, end);

    if (isDocOpen && !hasDocClose) {
      outIndent.push(depth);
      outContent.push(text.slice(start, end));
      inBlockComment = true;
      commentIndent = depth;
      lineStart = nextLineStart;
      continue;
    }

    const closer = isCloserCode(text.charCodeAt(start));
    const indent = Math.max(0, depth - (closer ? 1 : 0)) + (continuesExpression(text, start, end) ? 1 : 0);
    // Only top-level closers drop a preceding blank line (historical behavior).
    if (closer && indent === 0 && outContent.length > 0 && outContent[outContent.length - 1] === "") {
      outIndent.pop();
      outContent.pop();
    }
    outIndent.push(indent);
    outContent.push(collapseSpaces(text.slice(start, end)));
    lineStart = nextLineStart;

    // Single-line `/** ... */` comments never change depth.
    if (hasDocClose) continue;

    depth = scanTypeText(text, undefined, start, end, depth);
  }

  let count = outContent.length;
  while (count > 0 && outContent[count - 1] === "") count--;

  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i > 0) parts.push("\n");
    const indent = outIndent[i];
    if (indent > 0) parts.push(indentString(indent));
    parts.push(outContent[i]);
  }
  return parts.join("");
}

/** Structural reformat of generated `.d.ts` text (not a full printer: no line wrapping). */
export function formatGeneratedTypeScript(raw: string): string {
  return `${reindentAndTidy(expandRange(raw, 0, raw.length, computeBraceMatches(raw)))}\n`;
}
