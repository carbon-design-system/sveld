const INDENT_UNIT = "  ";
const CLOSER_START_REGEX = /^[}\])>]/;
const OPENERS = new Set(["{", "(", "["]);
const CLOSERS = new Set(["}", ")", "]"]);
// Conservative width for collapsing `{...}` onto one line; ignores surrounding indent.
const INLINE_WIDTH_BUDGET = 120;
// `interface` bodies always expand, unlike plain `{...}` type literals.
const INTERFACE_HEADER_REGEX = /\binterface\s+[A-Za-z_$][\w$]*(\s*<[^{};]*>)?\s*$/;
const TRAILING_TAB_SPACE_REGEX = /[ \t]+$/;
const TRAILING_WHITESPACE_REGEX = /\s+$/;
const OPENS_BLOCK_AT_END_REGEX = /[{([]$/;
const WHITESPACE_CHAR_REGEX = /\s/;

function endsWithInterfaceHeader(text: string): boolean {
  return INTERFACE_HEADER_REGEX.test(text.slice(-200));
}

function flattenToOneLine(content: string): string {
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
 * Finds the index of the `}` matching the `{` at `openIndex`, skipping over
 * nested brackets and string/comment contents so those never get mistaken
 * for structural braces. Returns -1 if unmatched (shouldn't happen for
 * well-formed generator output).
 */
function findMatchingClose(raw: string, openIndex: number): number {
  let depth = 0;
  let state: "normal" | "double" | "single" | "template" | "blockComment" = "normal";

  for (let i = openIndex; i < raw.length; i++) {
    const c = raw[i];
    const prev = raw[i - 1];

    if (state === "blockComment") {
      if (prev === "*" && c === "/") state = "normal";
      continue;
    }
    if (state === "double" || state === "single") {
      if (c === (state === "double" ? '"' : "'") && prev !== "\\") state = "normal";
      continue;
    }
    if (state === "template") {
      if (c === "`" && prev !== "\\") state = "normal";
      continue;
    }

    if (c === "/" && raw[i + 1] === "*") state = "blockComment";
    else if (c === '"') state = "double";
    else if (c === "'") state = "single";
    else if (c === "`") state = "template";
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
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
 */
function expandStatements(raw: string): string {
  let out = "";
  let state: "normal" | "double" | "single" | "template" | "blockComment" = "normal";

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    const prev = raw[i - 1];

    if (state === "blockComment") {
      out += c;
      if (prev === "*" && c === "/") state = "normal";
      continue;
    }

    if (state === "double" || state === "single") {
      out += c;
      if (c === (state === "double" ? '"' : "'") && prev !== "\\") state = "normal";
      continue;
    }

    if (state === "template") {
      out += c;
      if (c === "`" && prev !== "\\") state = "normal";
      continue;
    }

    // state === "normal"
    if (c === "/" && raw[i + 1] === "*") {
      state = "blockComment";
      out += c;
      continue;
    }
    if (c === '"') {
      state = "double";
      out += c;
      continue;
    }
    if (c === "'") {
      state = "single";
      out += c;
      continue;
    }
    if (c === "`") {
      state = "template";
      out += c;
      continue;
    }

    if (c === "{") {
      const closeIndex = findMatchingClose(raw, i);

      if (closeIndex === -1) {
        out += c;
        continue;
      }

      const content = raw.slice(i + 1, closeIndex);

      if (content.trim() === "") {
        // Empty block; keep braces adjacent instead of splitting across lines.
        out += "{}";
        i = closeIndex;
        continue;
      }

      // Expand interface bodies always; collapse other single-line `{...}` blocks under INLINE_WIDTH_BUDGET.
      if (!content.includes("/*") && raw[i + 1] !== "\n" && !endsWithInterfaceHeader(out)) {
        // Recurse so nested blocks get their own collapse decision.
        const normalized = expandStatements(content).trim();
        if (!normalized.includes("\n")) {
          const body = normalized.endsWith(";") ? normalized.slice(0, -1) : normalized;
          const candidate = `{ ${flattenToOneLine(body)} }`;
          if (candidate.length <= INLINE_WIDTH_BUDGET) {
            out += candidate;
            i = closeIndex;
            continue;
          }
        }
      }

      out += c;
      if (raw[i + 1] !== "\n") out += "\n";
      continue;
    }

    if (c === "}") {
      out = out.replace(TRAILING_TAB_SPACE_REGEX, "");
      if (!out.endsWith("\n")) out += "\n";
      out += c;
      continue;
    }

    if (c === ";") {
      // A `;` always terminates whatever precedes it; attach it directly
      // rather than let it dangle alone on a line (which the generator's
      // own templates sometimes leave a blank line or two before).
      out = out.replace(TRAILING_WHITESPACE_REGEX, "");
      out += ";";
      if (raw[i + 1] !== "\n") out += "\n";
      continue;
    }

    out += c;
  }

  return out;
}

function collapseSpaces(line: string): string {
  let out = "";
  let quote: "double" | "single" | "template" | null = null;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const prev = line[i - 1];

    if (quote) {
      out += c;
      if (
        (quote === "double" && c === '"' && prev !== "\\") ||
        (quote === "single" && c === "'" && prev !== "\\") ||
        (quote === "template" && c === "`" && prev !== "\\")
      ) {
        quote = null;
      }
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      quote = c === '"' ? "double" : c === "'" ? "single" : "template";
      out += c;
      continue;
    }

    if (c === " " && out.endsWith(" ")) continue;
    out += c;
  }

  return out;
}

/**
 * Recomputes indentation from bracket nesting depth, skipping content inside
 * block comments (JSDoc bodies may themselves contain `{`/`}`, e.g.
 * `{@link Foo}`, which must not perturb the running depth).
 */
function reindent(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let depth = 0;
  let inBlockComment = false;
  let commentIndent = 0;

  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();

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
      out.push(`${INDENT_UNIT.repeat(commentIndent)} ${trimmedLine}`);
      if (trimmedLine.includes("*/")) inBlockComment = false;
      continue;
    }

    if (trimmedLine.startsWith("/**") && !trimmedLine.includes("*/")) {
      out.push(INDENT_UNIT.repeat(depth) + trimmedLine);
      inBlockComment = true;
      commentIndent = depth;
      continue;
    }

    const line = collapseSpaces(trimmedLine);
    const startsWithCloser = CLOSER_START_REGEX.test(line);
    const indent = Math.max(0, depth - (startsWithCloser ? 1 : 0));
    out.push(INDENT_UNIT.repeat(indent) + line);

    // Single-line comments (`/** ... */`) and lines fully inside strings never
    // change bracket depth; everything else is scanned char-by-char.
    if (line.startsWith("/**") && line.includes("*/")) continue;

    let quote: "double" | "single" | "template" | null = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const prev = line[i - 1];

      if (quote) {
        if (
          (quote === "double" && c === '"' && prev !== "\\") ||
          (quote === "single" && c === "'" && prev !== "\\") ||
          (quote === "template" && c === "`" && prev !== "\\")
        ) {
          quote = null;
        }
        continue;
      }

      if (c === '"') quote = "double";
      else if (c === "'") quote = "single";
      else if (c === "`") quote = "template";
      else if (OPENERS.has(c)) depth++;
      else if (CLOSERS.has(c)) depth = Math.max(0, depth - 1);
      else if (c === "<") depth++;
      // Excludes the `>` in `=>`, which isn't a generic-list closer.
      else if (c === ">" && prev !== "=") depth = Math.max(0, depth - 1);
    }
  }

  return out.join("\n");
}

function tidyBlankLines(text: string): string {
  const lines = text.split("\n").map((line) => line.replace(TRAILING_TAB_SPACE_REGEX, ""));
  const out: string[] = [];

  for (const line of lines) {
    const isBlank = line === "";
    const prevBlank = out.length > 0 && out[out.length - 1] === "";
    const prevOpensBlock = out.length > 0 && OPENS_BLOCK_AT_END_REGEX.test(out[out.length - 1]);

    if (isBlank) {
      if (out.length === 0 || prevBlank || prevOpensBlock) continue;
      out.push(line);
      continue;
    }

    if (CLOSER_START_REGEX.test(line) && prevBlank) out.pop();
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
  const expanded = expandStatements(raw);
  const reindented = reindent(expanded);
  return `${tidyBlankLines(reindented)}\n`;
}
