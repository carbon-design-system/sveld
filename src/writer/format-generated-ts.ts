const INDENT_UNIT = "  ";
// Conservative width for collapsing `{...}` onto one line; ignores surrounding indent.
const INLINE_WIDTH_BUDGET = 120;
// `interface` bodies always expand, unlike plain `{...}` type literals.
const INTERFACE_HEADER_REGEX = /\binterface\s+[A-Za-z_$][\w$]*(\s*<[^{};]*>)?\s*$/;
const INTERFACE_HEADER_TAIL_LENGTH = 200;
const TRAILING_TAB_SPACE_REGEX = /[ \t]+$/;
const WHITESPACE_CHAR_REGEX = /\s/;
// Two consecutive whitespace chars, or any whitespace that isn't a plain space.
const NEEDS_FLATTEN_REGEX = /\s{2}|[^\S ]/;

// Character codes. The scanners below compare codes rather than one-char
// strings so the hot loops don't allocate.
const CH_TAB = 9;
const CH_LF = 10;
const CH_SPACE = 32;
const CH_DOUBLE_QUOTE = 34;
const CH_SINGLE_QUOTE = 39;
const CH_OPEN_PAREN = 40;
const CH_CLOSE_PAREN = 41;
const CH_STAR = 42;
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
const CH_CLOSE_BRACE = 125;

// Scanner states shared by `computeBraceMatches` and `expandRange`.
const STATE_NORMAL = 0;
const STATE_DOUBLE = 1;
const STATE_SINGLE = 2;
const STATE_TEMPLATE = 3;
const STATE_BLOCK_COMMENT = 4;

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
 * One pass over `raw` recording, for every `{` reached outside strings and
 * block comments, the index of its matching `}` (or -1 if unmatched). This
 * replaces a per-`{` forward scan, which re-walked every nested block once
 * per enclosing level.
 */
function computeBraceMatches(raw: string): Int32Array {
  const matches = new Int32Array(raw.length).fill(-1);
  const stack: number[] = [];
  let state = STATE_NORMAL;

  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);

    if (state === STATE_BLOCK_COMMENT) {
      if (c === CH_SLASH && raw.charCodeAt(i - 1) === CH_STAR) state = STATE_NORMAL;
      continue;
    }
    if (state === STATE_DOUBLE) {
      if (c === CH_DOUBLE_QUOTE && raw.charCodeAt(i - 1) !== CH_BACKSLASH) state = STATE_NORMAL;
      continue;
    }
    if (state === STATE_SINGLE) {
      if (c === CH_SINGLE_QUOTE && raw.charCodeAt(i - 1) !== CH_BACKSLASH) state = STATE_NORMAL;
      continue;
    }
    if (state === STATE_TEMPLATE) {
      if (c === CH_BACKTICK && raw.charCodeAt(i - 1) !== CH_BACKSLASH) state = STATE_NORMAL;
      continue;
    }

    if (c === CH_SLASH) {
      if (raw.charCodeAt(i + 1) === CH_STAR) state = STATE_BLOCK_COMMENT;
    } else if (c === CH_DOUBLE_QUOTE) {
      state = STATE_DOUBLE;
    } else if (c === CH_SINGLE_QUOTE) {
      state = STATE_SINGLE;
    } else if (c === CH_BACKTICK) {
      state = STATE_TEMPLATE;
    } else if (c === CH_OPEN_BRACE) {
      stack.push(i);
    } else if (c === CH_CLOSE_BRACE && stack.length > 0) {
      matches[stack.pop() as number] = i;
    }
  }

  return matches;
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
 * slices rather than one array entry per character.
 */
function expandRange(raw: string, from: number, to: number, matches: Int32Array): string {
  const out: string[] = [];
  let state = STATE_NORMAL;
  let runStart = from;

  for (let i = from; i < to; i++) {
    const c = raw.charCodeAt(i);

    if (state === STATE_BLOCK_COMMENT) {
      if (c === CH_SLASH && raw.charCodeAt(i - 1) === CH_STAR) state = STATE_NORMAL;
      continue;
    }
    if (state === STATE_DOUBLE) {
      if (c === CH_DOUBLE_QUOTE && raw.charCodeAt(i - 1) !== CH_BACKSLASH) state = STATE_NORMAL;
      continue;
    }
    if (state === STATE_SINGLE) {
      if (c === CH_SINGLE_QUOTE && raw.charCodeAt(i - 1) !== CH_BACKSLASH) state = STATE_NORMAL;
      continue;
    }
    if (state === STATE_TEMPLATE) {
      if (c === CH_BACKTICK && raw.charCodeAt(i - 1) !== CH_BACKSLASH) state = STATE_NORMAL;
      continue;
    }

    // state === STATE_NORMAL
    if (c === CH_SLASH) {
      if (raw.charCodeAt(i + 1) === CH_STAR) state = STATE_BLOCK_COMMENT;
      continue;
    }
    if (c === CH_DOUBLE_QUOTE) {
      state = STATE_DOUBLE;
      continue;
    }
    if (c === CH_SINGLE_QUOTE) {
      state = STATE_SINGLE;
      continue;
    }
    if (c === CH_BACKTICK) {
      state = STATE_TEMPLATE;
      continue;
    }

    if (c === CH_OPEN_BRACE) {
      const closeIndex = matches[i];
      // Unmatched: copy the brace through as ordinary text.
      if (closeIndex === -1 || closeIndex >= to) continue;

      if (runStart < i) out.push(raw.slice(runStart, i));
      const contentStart = i + 1;
      const content = raw.slice(contentStart, closeIndex);

      if (content.trim() === "") {
        // Empty block; keep braces adjacent instead of splitting across lines.
        out.push("{}");
        i = closeIndex;
        runStart = closeIndex + 1;
        continue;
      }

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
            i = closeIndex;
            runStart = closeIndex + 1;
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
        i = closeIndex - 1;
        runStart = closeIndex;
        continue;
      }

      out.push("{");
      if (!nextIsNewline) out.push("\n");
      runStart = contentStart;
      continue;
    }

    if (c === CH_CLOSE_BRACE) {
      if (runStart < i) out.push(raw.slice(runStart, i));
      popTrailingSpacesAndTabs(out);
      if (!endsWithNewline(out)) out.push("\n");
      out.push("}");
      runStart = i + 1;
      continue;
    }

    if (c === CH_SEMICOLON) {
      if (runStart < i) out.push(raw.slice(runStart, i));
      // A `;` always terminates whatever precedes it; attach it directly
      // rather than let it dangle alone on a line (which the generator's
      // own templates sometimes leave a blank line or two before).
      popTrailingWhitespace(out);
      out.push(";");
      if (raw.charCodeAt(i + 1) !== CH_LF) out.push("\n");
      runStart = i + 1;
    }
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

function startsWithCloser(line: string): boolean {
  const first = line.charCodeAt(0);
  return first === CH_CLOSE_BRACE || first === CH_CLOSE_BRACKET || first === CH_CLOSE_PAREN || first === CH_GT;
}

/**
 * Recomputes indentation from bracket nesting depth, skipping content inside
 * block comments (JSDoc bodies may themselves contain `{`/`}`, e.g.
 * `{@link Foo}`, which must not perturb the running depth). Returns the
 * reindented lines for `tidyBlankLines` to consume without re-splitting.
 */
function reindent(text: string): string[] {
  const lines = text.split("\n");
  const out: string[] = [];
  let depth = 0;
  let inBlockComment = false;
  let commentIndent = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const trimmedLine = lines[lineIndex].trim();

    if (trimmedLine === "") {
      out.push("");
      continue;
    }

    if (inBlockComment) {
      // Continuation lines (`* text`, closing `*/`) get one extra space so
      // the `*` aligns under the second `*` of the opening `/**`. Internal
      // spacing is otherwise left untouched — comment bodies may contain
      // authored code examples (e.g. an indented ```svelte fence) whose
      // whitespace is meaningful.
      out.push(`${indentString(commentIndent)} ${trimmedLine}`);
      if (trimmedLine.includes("*/")) inBlockComment = false;
      continue;
    }

    if (trimmedLine.startsWith("/**") && !trimmedLine.includes("*/")) {
      out.push(indentString(depth) + trimmedLine);
      inBlockComment = true;
      commentIndent = depth;
      continue;
    }

    const line = collapseSpaces(trimmedLine);
    const indent = Math.max(0, depth - (startsWithCloser(line) ? 1 : 0));
    out.push(indentString(indent) + line);

    // Single-line comments (`/** ... */`) and lines fully inside strings never
    // change bracket depth; everything else is scanned char-by-char.
    if (line.startsWith("/**") && line.includes("*/")) continue;

    let quote = 0;
    for (let i = 0; i < line.length; i++) {
      const c = line.charCodeAt(i);

      if (quote !== 0) {
        if (c === quote && line.charCodeAt(i - 1) !== CH_BACKSLASH) quote = 0;
        continue;
      }

      if (c === CH_DOUBLE_QUOTE || c === CH_SINGLE_QUOTE || c === CH_BACKTICK) quote = c;
      else if (c === CH_OPEN_BRACE || c === CH_OPEN_PAREN || c === CH_OPEN_BRACKET || c === CH_LT) depth++;
      else if (c === CH_CLOSE_BRACE || c === CH_CLOSE_PAREN || c === CH_CLOSE_BRACKET) depth = Math.max(0, depth - 1);
      // Excludes the `>` in `=>`, which isn't a generic-list closer.
      else if (c === CH_GT && line.charCodeAt(i - 1) !== CH_EQUALS) depth = Math.max(0, depth - 1);
    }
  }

  return out;
}

function tidyBlankLines(lines: string[]): string {
  const out: string[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    let line = lines[lineIndex];
    const lastCode = line.charCodeAt(line.length - 1);
    if (lastCode === CH_SPACE || lastCode === CH_TAB) line = line.replace(TRAILING_TAB_SPACE_REGEX, "");

    const prev = out.length > 0 ? out[out.length - 1] : undefined;
    const prevBlank = prev === "";

    if (line === "") {
      if (prev === undefined || prevBlank) continue;
      const prevLast = prev.charCodeAt(prev.length - 1);
      if (prevLast === CH_OPEN_BRACE || prevLast === CH_OPEN_PAREN || prevLast === CH_OPEN_BRACKET) continue;
      out.push(line);
      continue;
    }

    if (prevBlank && startsWithCloser(line)) out.pop();
    out.push(line);
  }

  while (out.length > 0 && out[out.length - 1] === "") out.pop();

  return out.join("\n");
}

/**
 * Reformats generator-emitted `.d.ts` source for consistent indentation and
 * spacing, without depending on an external formatter. This is a structural
 * cleanup pass (bracket-depth reindentation, blank-line normalization) rather
 * than a full TypeScript printer — it does not wrap long lines or rewrite
 * operator spacing.
 */
export function formatGeneratedTypeScript(raw: string): string {
  return `${tidyBlankLines(reindent(expandStatements(raw)))}\n`;
}
