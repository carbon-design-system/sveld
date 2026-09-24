const INDENT_UNIT = "  ";
// Conservative width for collapsing `{...}` onto one line; ignores surrounding indent.
const INLINE_WIDTH_BUDGET = 120;
// `interface` bodies always expand, unlike plain `{...}` type literals.
const INTERFACE_HEADER_REGEX = /\binterface\s+[A-Za-z_$][\w$]*(\s*<[^{};]*>)?\s*$/;
const INTERFACE_HEADER_TAIL_LENGTH = 200;
const WHITESPACE_CHAR_REGEX = /\s/;
// Two consecutive whitespace chars, or any whitespace that isn't a plain space.
const NEEDS_FLATTEN_REGEX = /\s{2}|[^\S ]/;

// The scanners below only ever act on a handful of characters. Each keeps a
// global regex and jumps between hits with `lastIndex`, instead of testing
// every character in JS. `test` (not `exec`) so no match array is allocated.
const BRACE_SCAN_REGEX = /["'`{}/]/g;
const STATEMENT_SCAN_REGEX = /["'`{};/]/g;

// Character codes. The scanners below compare codes rather than one-char
// strings so the hot loops don't allocate.
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
const CH_LT = 60;
const CH_EQUALS = 61;
const CH_GT = 62;
const CH_OPEN_BRACKET = 91;
const CH_BACKSLASH = 92;
const CH_CLOSE_BRACKET = 93;
const CH_BACKTICK = 96;
const CH_OPEN_BRACE = 123;
const CH_PIPE = 124;
const CH_CLOSE_BRACE = 125;

function endsWithInterfaceHeader(text: string): boolean {
  return INTERFACE_HEADER_REGEX.test(text.slice(-200));
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

// Reconstructs just enough of the accumulated buffer's tail to answer
// `endsWithInterfaceHeader`, without joining the whole (potentially huge)
// output array.
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

/** Removes trailing spaces/tabs from the end of the accumulated buffer. */
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

/** Removes all trailing whitespace (including newlines) from the end of the accumulated buffer. */
function popTrailingWhitespace(out: string[]): void {
  while (out.length > 0) {
    const last = out[out.length - 1];
    // Common case: the buffer ends in a non-whitespace char; skip the `trimEnd` copy.
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
 * Fast-path check for the `{...}` collapse decision below: content with no
 * nested `{` and 2+ statement-terminating `;` outside quotes is guaranteed
 * to expand onto multiple lines (each such `;` forces a following newline
 * once the character scan reaches it), so the speculative recursive
 * expansion that exists only to answer "would this collapse?" can be
 * skipped for this common flat multi-member case (e.g. a `{ id: string;
 * value: string; meta?: Record<string, unknown> }` object literal repeated
 * across many prop types). A single trailing `;` (one member) is
 * deliberately left to the general path since it may still collapse;
 * content with a nested `{` is also left to the general path, since a
 * collapsing inner block can change the outer decision.
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
  // Already flat: nothing to collapse.
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

/**
 * Index of the character that closes the string literal whose opening quote
 * sits at `open`, or -1 when it never closes. A quote directly
 * preceded by a backslash doesn't close (that includes `\\"`, matching the
 * per-character scan this replaced).
 */
function findStringClose(raw: string, open: number): number {
  const quote = raw[open];
  let at = raw.indexOf(quote, open + 1);
  while (at !== -1 && raw.charCodeAt(at - 1) === CH_BACKSLASH) {
    at = raw.indexOf(quote, at + 1);
  }
  return at;
}

/**
 * Index of the `/` that closes the block comment opening at `open` (the
 * index of its `/`), or -1 when it never closes. Like the per-character scan
 * this replaced, `/*` followed straight by `/` closes immediately.
 */
function findBlockCommentClose(raw: string, open: number): number {
  const at = raw.indexOf("*/", open + 1);
  return at === -1 ? -1 : at + 1;
}

/**
 * One pass over `raw` recording, for every `{` reached outside strings and
 * block comments, the index of its matching `}` (unmatched braces are simply
 * absent). This replaces a per-`{` forward scan, which re-walked every
 * nested block once per enclosing level. Keyed by brace index rather than
 * stored in a `raw.length`-sized table: braces are sparse, and a table the
 * size of the output had to be allocated and filled on every call.
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

/** True when `raw[from, to)` is whitespace only. Same answer as `raw.slice(from, to).trim() === ""`, without the copies. */
function isBlankRange(raw: string, from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    if (!isTrimmedWhitespace(raw.charCodeAt(i))) return false;
  }
  return true;
}

/**
 * Whether `String.prototype.trim` would strip this code unit: the ECMAScript
 * WhiteSpace and LineTerminator sets.
 */
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
 * Breaks the generator's hand-built template output onto separate statement
 * lines (after `{`, before `}`, after `;`), so the reindent pass below has a
 * stable one-token-per-boundary shape to work with. Runs a tiny state machine
 * rather than a regex so string/template literal contents (e.g. `"div"` in
 * `SvelteHTMLElements["div"]`) are never mistaken for structural brackets.
 *
 * A `{...}` block is only split onto multiple lines when it contains a `;` —
 * i.e. multiple statements/members. A short single-member span like
 * `{ id: string }` has nothing to separate onto its own line, so it's copied
 * through verbatim (matching how import specifier lists and small inline
 * object types read best on one line).
 *
 * Operates on the `[from, to)` range of `raw` so nested blocks recurse
 * without slicing, and copies unchanged runs of characters through as single
 * slices rather than one array entry per character. Strings and block
 * comments are skipped with `indexOf`; between them the scan jumps straight
 * to the next structural character.
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
        // Empty block; keep braces adjacent instead of splitting across lines.
        out.push("{}");
        i = closeIndex + 1;
        runStart = i;
        continue;
      }

      const content = raw.slice(contentStart, closeIndex);
      const nextIsNewline = raw.charCodeAt(contentStart) === CH_LF;

      // Expand interface bodies always; collapse other single-line `{...}` blocks under INLINE_WIDTH_BUDGET.
      if (
        !nextIsNewline &&
        !content.includes("/*") &&
        !hasMultipleFlatStatements(content) &&
        !endsWithInterfaceHeader(tailString(out, INTERFACE_HEADER_TAIL_LENGTH))
      ) {
        // Recurse so nested blocks get their own collapse decision.
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

        // The block stays expanded. The recursive pass already produced
        // exactly what rescanning `content` here would, so splice it in and
        // resume at the closing brace instead of walking the content again.
        // (A leading `;` would have consumed the newline after `{`, so skip it.)
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

    // c === CH_SEMICOLON
    if (runStart < i) out.push(raw.slice(runStart, i));
    // A `;` always terminates whatever precedes it; attach it directly
    // rather than let it dangle alone on a line (which the generator's
    // own templates sometimes leave a blank line or two before).
    popTrailingWhitespace(out);
    out.push(";");
    if (raw.charCodeAt(i + 1) !== CH_LF) out.push("\n");
    i++;
    runStart = i;
  }

  if (runStart < to) out.push(raw.slice(runStart, to));
  return out.join("");
}

function expandStatements(raw: string): string {
  return expandRange(raw, 0, raw.length, computeBraceMatches(raw));
}

/** Collapses runs of spaces outside quotes to a single space. */
function collapseSpaces(line: string): string {
  // No consecutive spaces anywhere: nothing to collapse.
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

/** Whether `text[at, end)` starts with `/**`. */
function startsWithDocOpen(text: string, at: number, end: number): boolean {
  return (
    end - at >= 3 &&
    text.charCodeAt(at) === CH_SLASH &&
    text.charCodeAt(at + 1) === CH_STAR &&
    text.charCodeAt(at + 2) === CH_STAR
  );
}

/** Whether `text[at, end)` contains `*​/`. */
function containsDocClose(text: string, at: number, end: number): boolean {
  const found = text.indexOf("*/", at);
  return found !== -1 && found + 2 <= end;
}

/**
 * Whether the line at `text[at, end)` continues the expression on the line
 * above: a wrapped union or intersection member (`| "b"`, `& B`) or member
 * access (`.Foo`, not a `...` spread), as a multi-line JSDoc `{type}` leaves
 * them. These sit one level deeper than the line they continue.
 */
function continuesExpression(text: string, at: number, end: number): boolean {
  const c = text.charCodeAt(at);
  if (c === CH_PIPE || c === CH_AMPERSAND) return true;
  return c === CH_DOT && at + 1 < end && text.charCodeAt(at + 1) !== CH_DOT;
}

/**
 * Recomputes indentation from bracket nesting depth, skipping content inside
 * block comments (JSDoc bodies may themselves contain `{`/`}`, e.g.
 * `{@link Foo}`, which must not perturb the running depth), and normalizes
 * blank lines in the same pass: runs of blank lines collapse to one, a blank
 * line directly after an opener (`{`, `(`, `[`) or directly before a
 * top-level closer is dropped, and trailing blank lines go.
 *
 * Works on offsets into `text` rather than `split`/`trim` copies of every
 * line, and keeps indent and content as separate array entries until the
 * final join. Concatenating them per line left every line a rope that the
 * next `charCodeAt` had to flatten, which cost more than the reindent itself.
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

    // Trim bounds, same set of characters `String.prototype.trim` strips.
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
      // Continuation lines (`* text`, closing `*/`) get one extra space so
      // the `*` aligns under the second `*` of the opening `/**`. Internal
      // spacing is otherwise left untouched — comment bodies may contain
      // authored code examples (e.g. an indented ```svelte fence) whose
      // whitespace is meaningful.
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
    // A blank line directly before a top-level closer is dropped. Only
    // top-level: an indented closer starts with a space, so it never
    // counted as a closer here before the indent and content were split.
    if (closer && indent === 0 && outContent.length > 0 && outContent[outContent.length - 1] === "") {
      outIndent.pop();
      outContent.pop();
    }
    outIndent.push(indent);
    outContent.push(collapseSpaces(text.slice(start, end)));
    lineStart = nextLineStart;

    // Single-line comments (`/** ... */`) and lines fully inside strings never
    // change bracket depth; everything else is scanned char-by-char.
    // (Collapsing space runs can't change any of these decisions, so the
    // scan reads the uncollapsed text in place.)
    if (hasDocClose) continue;

    let quote = 0;
    for (let i = start; i < end; i++) {
      const c = text.charCodeAt(i);

      if (quote !== 0) {
        if (c === quote && text.charCodeAt(i - 1) !== CH_BACKSLASH) quote = 0;
        continue;
      }

      if (c === CH_DOUBLE_QUOTE || c === CH_SINGLE_QUOTE || c === CH_BACKTICK) quote = c;
      else if (c === CH_OPEN_BRACE || c === CH_OPEN_PAREN || c === CH_OPEN_BRACKET || c === CH_LT) depth++;
      else if (c === CH_CLOSE_BRACE || c === CH_CLOSE_PAREN || c === CH_CLOSE_BRACKET) depth = Math.max(0, depth - 1);
      // Excludes the `>` in `=>`, which isn't a generic-list closer.
      else if (c === CH_GT && text.charCodeAt(i - 1) !== CH_EQUALS) depth = Math.max(0, depth - 1);
    }
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

/**
 * Reformats generator-emitted `.d.ts` source for consistent indentation and
 * spacing, without depending on an external formatter. This is a structural
 * cleanup pass (bracket-depth reindentation, blank-line normalization) rather
 * than a full TypeScript printer — it does not wrap long lines or rewrite
 * operator spacing.
 */
export function formatGeneratedTypeScript(raw: string): string {
  return `${reindentAndTidy(expandStatements(raw))}\n`;
}
