/**
 * sveld's own `/** ... *\/` block-comment parser.
 *
 * A Svelte component's JSDoc comments are the source of truth for prop types, descriptions,
 * and structural tags (`@slot`, `@event`, `@typedef`, `@callback`, ...). This module turns a
 * block's raw text into a description plus a list of `@tag` entries, each split into an
 * optional `{type}`, an optional `name`/`[name=default]`, and the remaining description text -
 * covering exactly the JSDoc grammar `./jsdoc.ts` and `./variable-jsdoc.ts` read.
 *
 * One thing this intentionally does NOT support, because nothing in sveld's grammar uses it: bare
 * `name=default` without brackets (every default in sveld's own JSDoc, e.g. `@template
 * [T=string]`, uses `[...]`). A name may still be wrapped in matching quotes (e.g. `@event
 * "change"`); the quotes are stripped so it matches the same key as its unquoted form. Parsing
 * here is best-effort rather than abort-on-malformed-input: an unpaired `[` or `{` just falls
 * back to treating the text as plain description rather than dropping the tag's other fields.
 *
 * Indentation after the `*` gutter is preserved (not trimmed) so multi-line tag bodies - most
 * importantly `@example` code blocks - keep their original formatting. Each line also keeps its
 * absolute character offset in the scanned source, so callers can compute exact source ranges
 * without re-deriving offsets by walking line lengths.
 */

export interface CommentLine {
  /** Raw, unmodified text of this physical source line. */
  raw: string;
  /** Absolute character offset in the scanned source where this line begins. */
  start: number;
  /** 0-based index of this line within its comment block's `lines` array. */
  number: number;
  /**
   * Whitespace between the gutter (`*` or the opening `/**`) and the line's content, minus the
   * gutter's own canonical single separator space - what's left is meaningful indentation.
   */
  indent: string;
  /** The full, unreduced whitespace between the gutter and the line's content (`" " + indent` when the gutter's canonical space was present, `indent` alone otherwise). */
  separator: string;
  /** Content after the gutter and, for a tag's opening line, whatever tag/type/name parsing has consumed so far. */
  content: string;
  /** Set only on a tag section's first line, once tag parsing has run. */
  tag?: string;
}

export interface JSDocTag {
  tag: string;
  name: string;
  type: string;
  optional: boolean;
  default?: string;
  description: string;
  /**
   * The tag's full original body text (after `@tag`), indentation preserved, untouched by
   * type/name parsing - for tags sveld treats as opaque prose (`@since`, `@example`, and any
   * tag it doesn't otherwise structurally interpret).
   */
  raw: string;
  /** This tag's own physical lines, post type/name extraction (shares objects with the parent `JSDocComment.lines`). */
  lines: CommentLine[];
}

export interface JSDocComment {
  description: string;
  tags: JSDocTag[];
  /** Absolute character offset where this block's `/**` begins in the scanned source. */
  start: number;
  /** All physical lines of the block, post type/name extraction (shared with each tag's own `lines`). */
  lines: CommentLine[];
}

const BLOCK_OPEN = "/**";
const BLOCK_OPEN_IGNORE = "/***";
const GUTTER = "*";
const BLOCK_CLOSE = "*/";
const FENCE = "```";

const NEWLINE_REGEX = /\n/;
const TRAILING_CR_REGEX = /\r$/;
const LEADING_WS_REGEX = /^\s+/;
const WHITESPACE_CHAR_REGEX = /\s/;
const TAG_SECTION_START_REGEX = /^@[^\s/]+(?=\s|$)/;
const TAG_PREFIX_REGEX = /^@(\S+)\s*/;

interface PhysicalLine {
  /** `\r`-stripped text of this line. */
  text: string;
  /** Absolute character offset where this line begins in the scanned source. */
  start: number;
}

function splitSourceLines(source: string): PhysicalLine[] {
  const lines: PhysicalLine[] = [];
  let offset = 0;
  for (const segment of source.split(NEWLINE_REGEX)) {
    lines.push({ text: segment.replace(TRAILING_CR_REGEX, ""), start: offset });
    offset += segment.length + 1;
  }
  return lines;
}

/** Strips the comment gutter from one physical line, splitting what's left into `indent`/`separator` + `content`. */
function tokenizeLine(text: string, isOpeningLine: boolean): { indent: string; separator: string; content: string } {
  let rest = text.replace(LEADING_WS_REGEX, "");
  let hasMarker = false;

  if (isOpeningLine) {
    rest = rest.slice(BLOCK_OPEN.length);
    hasMarker = true;
  } else if (rest.startsWith(GUTTER) && !rest.startsWith(BLOCK_CLOSE)) {
    rest = rest.slice(GUTTER.length);
    hasMarker = true;
  }

  const separator = rest.match(LEADING_WS_REGEX)?.[0] ?? "";
  rest = rest.slice(separator.length);

  const trimmedEnd = rest.trimEnd();
  const content = trimmedEnd.endsWith(BLOCK_CLOSE) ? trimmedEnd.slice(0, -BLOCK_CLOSE.length) : rest;

  // The gutter convention is "marker + exactly one separator space"; anything past that first
  // space is meaningful indentation and gets preserved as part of `indent`.
  const indent = hasMarker ? separator.slice(1) : separator;
  return { indent, separator, content };
}

/** Finds every `/** ... *\/` block in `source`, tokenizing each line's gutter as it goes. */
function findCommentBlocks(source: string): Array<{ start: number; lines: CommentLine[] }> {
  // Every block starts with `/**`. If that substring is absent, skip
  // splitting the source into lines. `/***` starts with the same three
  // characters, so this can't miss an ignore-block either.
  if (!source.includes(BLOCK_OPEN)) return [];

  const blocks: Array<{ start: number; lines: CommentLine[] }> = [];
  const physicalLines = splitSourceLines(source);

  let current: CommentLine[] | null = null;
  let blockStart = 0;

  for (const line of physicalLines) {
    if (current === null) {
      const trimmed = line.text.replace(LEADING_WS_REGEX, "");
      if (!trimmed.startsWith(BLOCK_OPEN) || trimmed.startsWith(BLOCK_OPEN_IGNORE)) continue;
      current = [];
      blockStart = line.start + (line.text.length - trimmed.length);
    }

    const { indent, separator, content } = tokenizeLine(line.text, current.length === 0);
    current.push({ raw: line.text, start: line.start, number: current.length, indent, separator, content });

    if (line.text.trimEnd().endsWith(BLOCK_CLOSE)) {
      blocks.push({ start: blockStart, lines: current });
      current = null;
    }
  }

  return blocks;
}

/** Drops a pure `/**` opening line or pure `*​/` closing line - boilerplate that carries no content. */
function trimBoilerplateEdges(lines: CommentLine[]): CommentLine[] {
  let result = lines;
  if (result.length > 0 && result[0].content === "") result = result.slice(1);
  if (result.length > 0 && result[result.length - 1].content === "") result = result.slice(0, -1);
  return result;
}

/** Splits a block's lines into a leading description section plus one section per `@tag`, skipping `@`-looking text inside fenced (```` ``` ````) code. */
function splitIntoSections(lines: CommentLine[]): CommentLine[][] {
  const sections: CommentLine[][] = [[]];
  let fenced = false;

  for (const line of lines) {
    if (TAG_SECTION_START_REGEX.test(line.content) && !fenced) {
      sections.push([line]);
    } else {
      sections[sections.length - 1].push(line);
    }
    if (line.content.split(FENCE).length % 2 === 0) fenced = !fenced;
  }

  return sections;
}

function joinLines(lines: CommentLine[]): string {
  return lines.map((line) => line.indent + line.content).join("\n");
}

/**
 * Consumes a leading, possibly multi-line, balanced `{...}` from `lines` starting at
 * `fromIndex` (skipping past any lines still empty from a previous consumption). Mutates the
 * consumed lines' `content` in place; returns `null` (no mutation) if the section doesn't open
 * with `{` or the braces never balance.
 */
function extractType(lines: CommentLine[], fromIndex: number): { type: string; endIndex: number } | null {
  let start = fromIndex;
  while (start < lines.length - 1 && lines[start].content.trim() === "") start++;
  if (lines[start].content[0] !== "{") return null;

  let depth = 0;
  const consumedPerLine: number[] = [];
  let i = start;
  for (; i < lines.length; i++) {
    const content = lines[i].content;
    let consumed = 0;
    for (const ch of content) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      consumed++;
      if (depth === 0) break;
    }
    consumedPerLine.push(consumed);
    if (depth === 0) break;
  }
  if (depth !== 0) return null;

  const endIndex = i;
  const fragments = consumedPerLine.map((count, idx) => {
    const lineIndex = start + idx;
    const fragment = lines[lineIndex].content.slice(0, count);
    // Drop the separator whitespace right after the type here (rather than leaving it for name
    // extraction to consume) so a typeless-name tag like `@type {Foo}` doesn't leave a stray
    // space behind as its "description" when there's no name/description to follow it.
    lines[lineIndex].content = lines[lineIndex].content.slice(count).replace(LEADING_WS_REGEX, "");
    return idx === 0 ? fragment : lines[lineIndex].indent + fragment;
  });

  return { type: fragments.join("\n").slice(1, -1), endIndex };
}

/**
 * Consumes a leading name token from `line` - either `name`, or `[name]`/`[name=default]` for an
 * optional param (the only default syntax sveld's own JSDoc ever uses). Mutates `line.content`
 * in place on success; returns `null` (no mutation) if there's nothing there or the brackets
 * don't balance, leaving the text for the description to pick up instead.
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
    // Split on every "=" and rejoin everything past the first back together, so a default value
    // that itself contains "=" (e.g. an arrow function, `[cb=() => 1]`) survives intact.
    const parts = inner.split("=");
    name = parts[0].trim();
    if (parts.length > 1) defaultValue = parts.slice(1).join("=").trim();
    if (!name) return null;
  }

  // A name may be wrapped in matching quotes (e.g. `@event "change"`) to mark it as a literal -
  // JSDoc convention, not part of sveld's own grammar. Unwrap it so a quoted name matches the
  // same key as its unquoted form (e.g. an inferred `dispatch("change", ...)` event name).
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

  // Snapshot the pristine body text before type/name extraction mutates it below. A tag opening
  // line with nothing after the tag itself (e.g. a bare `@example` before a fenced code block)
  // contributes no line of its own - only its continuation lines make up the body.
  const firstBodyLine = afterTagPrefix.trimEnd();
  const continuationLines = sectionLines.slice(1).map((line) => line.separator + line.content);
  const raw = (firstBodyLine ? [firstBodyLine, ...continuationLines] : continuationLines).join("\n");

  first.content = afterTagPrefix;
  first.tag = tag;

  const typeResult = extractType(sectionLines, 0);
  const type = typeResult?.type ?? "";

  let nameIndex = 0;
  if (typeResult) {
    nameIndex = typeResult.endIndex;
    while (nameIndex < sectionLines.length - 1 && sectionLines[nameIndex].content.trim() === "") nameIndex++;
  }
  const nameResult = extractName(sectionLines[nameIndex]);

  const description = joinLines(sectionLines.slice(typeResult ? typeResult.endIndex : 0));

  return {
    tag,
    name: nameResult?.name ?? "",
    type,
    optional: nameResult?.optional ?? false,
    default: nameResult?.default,
    description,
    raw,
    lines: sectionLines,
  };
}

function parseBlock(rawLines: CommentLine[], start: number): JSDocComment {
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
    lines,
  };
}

/** Parses every `/** ... *\/` block found in `source`. */
export function parseComments(source: string): JSDocComment[] {
  return findCommentBlocks(source).map(({ start, lines }) => parseBlock(lines, start));
}
