/**
 * sveld's own `/** ... *\/` parser: a description plus `@tag` entries, each split into an
 * optional `{type}`, an optional `name`/`[name=default]`, and description text.
 *
 * Best-effort: an unpaired `[` or `{` falls back to description text. Bare `name=default`
 * without brackets is unsupported. Indentation after the gutter is kept so `@example` code
 * keeps its formatting, and each line keeps its absolute source offset for source ranges.
 */

import { indexOfClosingBracket } from "../type-text";

interface CommentLine {
  raw: string;
  /** Absolute offset in the scanned source. */
  start: number;
  /** Index within the block's `lines`. */
  number: number;
  /** Whitespace after the gutter, minus its one separator space. */
  indent: string;
  /** Text after the gutter, minus whatever tag/type/name parsing has consumed. */
  content: string;
  /** Set on a tag section's first line. */
  tag?: string;
  /**
   * Set on each line after a tag's first that its multi-line `{type}` runs onto. The last such
   * line holds whatever follows the closing `}` (name, description) - the tag's own line in
   * every sense but the physical one.
   */
  continuesType?: true;
}

export interface JSDocTag {
  tag: string;
  name: string;
  type: string;
  optional: boolean;
  default?: string;
  description: string;
  /** Body text after `@tag` as written, braces included, untouched by type/name parsing. */
  text: string;
  /** Shares objects with the parent `JSDocComment.lines`. */
  lines: CommentLine[];
}

export interface JSDocComment {
  description: string;
  tags: JSDocTag[];
  /** Absolute offset of `/**`. */
  start: number;
  /** Absolute offset just past `*\/`. */
  end: number;
  lines: CommentLine[];
}

const BLOCK_OPEN = "/**";
const GUTTER = "*";
const BLOCK_CLOSE = "*/";
const FENCE = "```";

const LEADING_WS_REGEX = /^\s+/;
const WHITESPACE_CHAR_REGEX = /\s/;
const TAG_SECTION_START_REGEX = /^@[^\s/]+(?=\s|$)/;
const TAG_PREFIX_REGEX = /^@(\S+)\s*/;

/** Tags that mean nothing without a name, so the name may wrap onto a line of its own. */
const NAME_REQUIRED_TAGS = new Set(["extends", "extendProps", "generics", "template", "typedef"]);

/** Length of the leading `\s` run in `text`. */
export function leadingWhitespaceLength(text: string): number {
  let index = 0;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    // Fast path for space/tab/CR/LF before the regex.
    if (code !== 32 && code !== 9 && code !== 13 && code !== 10 && !WHITESPACE_CHAR_REGEX.test(text[index])) break;
    index++;
  }
  return index;
}

/** Strips the comment gutter from one physical line, splitting what's left into `indent` + `content`. */
function tokenizeLine(text: string, isOpeningLine: boolean): { indent: string; content: string } {
  let rest = text.slice(leadingWhitespaceLength(text));
  let hasMarker = false;

  if (isOpeningLine) {
    rest = rest.slice(BLOCK_OPEN.length);
    hasMarker = true;
  } else if (rest.startsWith(GUTTER) && !rest.startsWith(BLOCK_CLOSE)) {
    rest = rest.slice(GUTTER.length);
    hasMarker = true;
  }

  const separator = rest.slice(0, leadingWhitespaceLength(rest));
  rest = rest.slice(separator.length);

  const trimmedEnd = rest.trimEnd();
  const content = trimmedEnd.endsWith(BLOCK_CLOSE) ? trimmedEnd.slice(0, -BLOCK_CLOSE.length).trimEnd() : rest;

  // The gutter is "marker + one space"; any further whitespace is indentation.
  const indent = hasMarker ? separator.slice(1) : separator;
  return { indent, content };
}

/** `\r`-stripped text of the physical line spanning `[lineStart, lineEnd)`. */
function physicalLineText(source: string, lineStart: number, lineEnd: number): string {
  const end = lineEnd > lineStart && source.charCodeAt(lineEnd - 1) === 13 /* \r */ ? lineEnd - 1 : lineEnd;
  return source.slice(lineStart, end);
}

/**
 * Every `/** ... *\/` block in `source`. A block opens on a line whose first text is `/**` (not
 * `/***`) and closes on the first line ending with `*\/`; an unterminated block is dropped. Jumps
 * between `/**` with `indexOf` rather than splitting the whole source into lines.
 */
function findCommentBlocks(source: string): Array<{ start: number; end: number; lines: CommentLine[] }> {
  const blocks: Array<{ start: number; end: number; lines: CommentLine[] }> = [];
  let searchFrom = 0;

  while (true) {
    const openIndex = source.indexOf(BLOCK_OPEN, searchFrom);
    if (openIndex === -1) break;

    const lineStart = source.lastIndexOf("\n", openIndex - 1) + 1;
    if (
      source.charCodeAt(openIndex + BLOCK_OPEN.length) === 42 /* `*`: this is `/***`, an ignore-block */ ||
      source.slice(lineStart, openIndex).trim() !== ""
    ) {
      searchFrom = openIndex + 1;
      continue;
    }

    const lines: CommentLine[] = [];
    let currentLineStart = lineStart;
    let closed = false;
    let closeEnd = 0;

    while (currentLineStart <= source.length) {
      const newlineIndex = source.indexOf("\n", currentLineStart);
      const lineEnd = newlineIndex === -1 ? source.length : newlineIndex;
      const text = physicalLineText(source, currentLineStart, lineEnd);

      const { indent, content } = tokenizeLine(text, lines.length === 0);
      lines.push({ raw: text, start: currentLineStart, number: lines.length, indent, content });

      const trimmedText = text.trimEnd();
      if (trimmedText.endsWith(BLOCK_CLOSE)) {
        closed = true;
        closeEnd = currentLineStart + trimmedText.length;
        searchFrom = lineEnd;
        break;
      }
      if (newlineIndex === -1) break;
      currentLineStart = newlineIndex + 1;
    }

    // Unterminated block: nothing after it can open another one.
    if (!closed) break;
    blocks.push({ start: openIndex, end: closeEnd, lines });
  }

  return blocks;
}

/** Drops an empty `/**` opening line or `*​/` closing line. */
function trimBoilerplateEdges(lines: CommentLine[]): CommentLine[] {
  let result = lines;
  if (result.length > 0 && result[0].content === "") result = result.slice(1);
  if (result.length > 0 && result[result.length - 1].content === "") result = result.slice(0, -1);
  return result;
}

/** Splits lines into a leading description section plus one per `@tag`, ignoring `@` inside fenced code. */
function splitIntoSections(lines: CommentLine[]): CommentLine[][] {
  const sections: CommentLine[][] = [[]];
  let fenced = false;

  for (const line of lines) {
    if (TAG_SECTION_START_REGEX.test(line.content) && !fenced) {
      sections.push([line]);
    } else {
      sections[sections.length - 1].push(line);
    }
    if (togglesCodeFence(line.content)) fenced = !fenced;
  }

  return sections;
}

/** Whether `text` opens or closes a fenced (```` ``` ````) code block: an odd number of fences. */
export function togglesCodeFence(text: string): boolean {
  return countOccurrences(text, FENCE) % 2 === 1;
}

/** Non-overlapping `needle` occurrences in `text`, without a `split` allocation. */
function countOccurrences(text: string, needle: string): number {
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count++;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

function joinLines(lines: CommentLine[]): string {
  return lines.map((line) => line.indent + line.content).join("\n");
}

/**
 * Consumes a leading, possibly multi-line, balanced `{...}`, mutating the consumed lines'
 * `content`. Returns `null` without mutating if there's no `{` or the braces never balance.
 */
function extractType(lines: CommentLine[]): { type: string; endIndex: number } | null {
  let start = 0;
  while (start < lines.length - 1 && lines[start].content.trim() === "") start++;
  if (lines[start].content[0] !== "{") return null;

  // Scanned as one text so a string literal type (`{"}"}`) that spans lines still hides its brackets.
  const text = lines
    .slice(start)
    .map((line) => line.content)
    .join("\n");
  const closeIndex = indexOfClosingBracket(text, 0);
  if (closeIndex === -1) return null;

  const consumedPerLine: number[] = [];
  let remaining = closeIndex + 1;
  for (let i = start; remaining > 0; i++) {
    const length = lines[i].content.length;
    consumedPerLine.push(Math.min(remaining, length));
    remaining -= length + 1;
  }

  const endIndex = start + consumedPerLine.length - 1;
  const fragments = consumedPerLine.map((count, idx) => {
    const lineIndex = start + idx;
    const fragment = lines[lineIndex].content.slice(0, count);
    // Drop the whitespace after the type here so `@type {Foo}` doesn't leave a stray space as its description.
    lines[lineIndex].content = lines[lineIndex].content.slice(count).replace(LEADING_WS_REGEX, "");
    if (lineIndex > 0) lines[lineIndex].continuesType = true;
    return idx === 0 ? fragment : lines[lineIndex].indent + fragment;
  });

  return { type: fragments.join("\n").slice(1, -1), endIndex };
}

/**
 * Consumes a leading `name`, `[name]`, or `[name=default]` from `line`, mutating `line.content`.
 * Returns `null` without mutating if there's none or the brackets don't balance.
 */
function extractName(line: CommentLine): { name: string; optional: boolean; default?: string } | null {
  const leadingWs = line.content.match(LEADING_WS_REGEX)?.[0] ?? "";
  const source = line.content.slice(leadingWs.length);

  let depth = 0;
  let consumed = 0;
  for (const ch of source) {
    if (depth === 0 && WHITESPACE_CHAR_REGEX.test(ch)) break;
    if (ch === "[") depth++;
    if (ch === "]") depth--;
    consumed++;
  }

  const token = depth === 0 ? source.slice(0, consumed) : "";
  if (!token) return null;

  let name = token;
  let optional = false;
  let defaultValue: string | undefined;

  if (token.startsWith("[") && token.endsWith("]")) {
    optional = true;
    const inner = token.slice(1, -1);
    // Rejoin past the first "=" so a default containing "=" (`[cb=() => 1]`) survives.
    const parts = inner.split("=");
    name = parts[0].trim();
    if (parts.length > 1) defaultValue = parts.slice(1).join("=").trim();
    if (!name) return null;
  }

  // Unquote `@event "change"` so it matches the inferred `dispatch("change")` name.
  if (name.length > 1 && (name[0] === '"' || name[0] === "'") && name[name.length - 1] === name[0]) {
    name = name.slice(1, -1);
  }

  line.content = source.slice(consumed).replace(LEADING_WS_REGEX, "");
  return { name, optional, default: defaultValue };
}

function parseTagSection(sectionLines: CommentLine[]): JSDocTag {
  const first = sectionLines[0];
  const tagMatch = first.content.match(TAG_PREFIX_REGEX);
  const tag = tagMatch ? tagMatch[1] : "";
  const afterTagPrefix = tagMatch ? first.content.slice(tagMatch[0].length) : first.content;

  // Snapshot the body before extraction mutates it. A bare `@example` line contributes no line of its own.
  const firstBodyLine = afterTagPrefix.trimEnd();
  const proseLines = sectionLines.slice(1).map((line) => line.indent + line.content);
  const text = (firstBodyLine ? [firstBodyLine, ...proseLines] : proseLines).join("\n");

  first.content = afterTagPrefix;
  first.tag = tag;

  const typeResult = extractType(sectionLines);
  const type = typeResult?.type ?? "";

  // The name shares the line the type ends on, so after `@slot {{ item: string }}` the next line
  // stays description. A tag that requires a name may take it from the next non-empty line.
  let nameLineIndex = typeResult?.endIndex ?? 0;
  if (NAME_REQUIRED_TAGS.has(tag)) {
    while (nameLineIndex < sectionLines.length - 1 && sectionLines[nameLineIndex].content.trim() === "") {
      nameLineIndex++;
    }
  }
  const nameResult = extractName(sectionLines[nameLineIndex]);

  const description = joinLines(sectionLines.slice(nameLineIndex));

  return {
    tag,
    name: nameResult?.name ?? "",
    type,
    optional: nameResult?.optional ?? false,
    default: nameResult?.default,
    description,
    text,
    lines: sectionLines,
  };
}

function parseBlock(rawLines: CommentLine[], start: number, end: number): JSDocComment {
  const lines = trimBoilerplateEdges(rawLines);
  lines.forEach((line, index) => {
    line.number = index;
  });

  const sections = splitIntoSections(lines);
  const tags = sections.slice(1).map(parseTagSection);

  return {
    description: joinLines(sections[0]),
    tags,
    start,
    end,
    lines,
  };
}

/** Parses every `/** ... *\/` block found in `source`. */
export function parseComments(source: string): JSDocComment[] {
  return findCommentBlocks(source).map(({ start, end, lines }) => parseBlock(lines, start, end));
}
