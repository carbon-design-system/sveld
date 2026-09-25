import type { ComponentProp, DeprecatedValue } from "../ComponentParser";
import { formatClassMemberSignature, formatTsProps } from "./writer-ts-definitions-core";

export const BACKTICK_REGEX = /`/g;
export const WHITESPACE_REGEX = /\s+/g;

export const MD_TYPE_UNDEFINED = "--";

export const PROP_TABLE_HEADER =
  "| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |\n| :- | :- | :- | :- | :- | :- | :- | :- |\n";
export const SLOT_TABLE_HEADER =
  "| Slot name | Default | Props | Fallback | Description |\n| :- | :- | :- | :- | :- |\n";
export const EVENT_TABLE_HEADER = "| Event name | Type | Detail | Description |\n| :- | :- | :- | :- |\n";
export const EXPORT_TABLE_HEADER = "| Name | Kind | Type | Description |\n| :- | :- | :- | :- |\n";
export const CLASS_MEMBER_TABLE_HEADER = "| Member | Signature | Description |\n| :- | :- | :- |\n";
export const CSS_PART_TABLE_HEADER = "| Part name | Description |\n| :- | :- |\n";
export const CSS_PROPERTY_TABLE_HEADER =
  "| Property name | Type | Default value | Description |\n| :- | :- | :- | :- |\n";

const PIPE_REGEX = /\|/g;
const LT_REGEX = /</g;
const GT_REGEX = />/g;
const NEWLINE_REGEX = /\n/g;
const IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*$/;
const LINE_BREAK_REGEX = /\s*\n\s*/g;
const ENTITY_AMPERSAND_REGEX = /&(?=#?\w+;)/g;
const TAG_OPEN_REGEX = /<(?=[A-Za-z/!?])/g;
const CODE_SPECIAL_CHAR_REGEX = /[|`*]|\\(?=[!-/:-@[-`{-~])/g;
const EMPHASIS_UNDERSCORE_REGEX = /(?<![A-Za-z0-9])_|_(?![A-Za-z0-9])/g;

/**
 * Markdown still parses the text inside a `<code>` element, so `Promise<void>`
 * would lose `<void>` as an unknown HTML tag, and a backtick, `*`, or
 * word-edge `_` would start a code span or emphasis. Encode just those, so
 * the raw Markdown stays readable.
 */
function escapeCodeText(text: string): string {
  return text
    .replace(ENTITY_AMPERSAND_REGEX, "&amp;")
    .replace(TAG_OPEN_REGEX, "&lt;")
    .replace(CODE_SPECIAL_CHAR_REGEX, (match) => `&#${match.charCodeAt(0)};`)
    .replace(EMPHASIS_UNDERSCORE_REGEX, "&#95;");
}

/** A `<code>` table cell; a multi-line type or value joins onto one line so it can't split the row. */
function codeCell(text: string): string {
  return `<code>${escapeCodeText(text.replace(LINE_BREAK_REGEX, " "))}</code>`;
}

/** `{@link target}` or `{@link target|display text}`, per the inline JSDoc `@link` tag grammar. */
const JSDOC_LINK_REGEX = /\{@link\s+([^{}\s|]+)(?:\|([^{}]+))?\}/g;

/**
 * Rewrites inline `{@link target|text}` / `{@link target}` to Markdown
 * `[text](target)` / `[target](target)`. Markdown-only: JSON and `.d.ts`
 * keep the JSDoc tag verbatim.
 */
function rewriteJsDocLinks(text: string): string {
  return text.replace(JSDOC_LINK_REGEX, (_match, target: string, label: string | undefined) => {
    const linkText = label === undefined ? target : label.trim();
    return `[${linkText}](${target})`;
  });
}

/** A fenced code block from a table cell's text, verbatim. */
export interface CellCodeBlock {
  /** The opening fence marker, e.g. "```" or "~~~~". */
  fence: string;
  /** The info string after the opening fence, e.g. "svelte"; may be empty. */
  info: string;
  code: string;
}

/** Prose is already HTML-escaped with `{@link}` rewritten; pipes and newlines are left for {@link renderCellParts}. */
type CellPart = { kind: "prose"; text: string } | { kind: "code"; block: CellCodeBlock };

const FENCE_OPEN_REGEX = /^([ \t]*)(`{3,}|~{3,})(.*)$/;
const LEADING_NEWLINE_REGEX = /^\n/;
const TRAILING_NEWLINE_REGEX = /\n$/;

/**
 * Splits text on its fenced code blocks, CommonMark-style: a fence closes
 * on a line of the same marker character at least as long, an unclosed
 * fence runs to the end, and code lines lose up to the opening fence's
 * indentation. A prose part keeps the line breaks that border a fence, so
 * joining the parts' text back up gives the original line structure.
 */
function splitCodeFences(text: string): CellPart[] {
  const prose = (lines: string[]): CellPart => ({
    kind: "prose",
    text: escapeHtml(rewriteJsDocLinks(lines.join("\n"))),
  });
  if (!text.includes("```") && !text.includes("~~~")) return [prose([text])];

  const lines = text.split("\n");
  const parts: CellPart[] = [];
  // A "" entry at either end of `proseLines` stands in for a bordering fence, so join("\n") keeps that line break.
  let proseLines: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const open = FENCE_OPEN_REGEX.exec(lines[index]);
    const [, indent = "", fence = "", info = ""] = open ?? [];
    if (!open || (fence[0] === "`" && info.includes("`"))) {
      proseLines.push(lines[index]);
      continue;
    }

    proseLines.push("");
    if (proseLines.length > 1) parts.push(prose(proseLines));

    const codeLines: string[] = [];
    const closeRegex = new RegExp(`^[ \\t]*${fence[0]}{${fence.length},}[ \\t]*$`);
    for (index++; index < lines.length && !closeRegex.test(lines[index]); index++) {
      const line = lines[index];
      let strip = 0;
      while (strip < indent.length && (line[strip] === " " || line[strip] === "\t")) strip++;
      codeLines.push(line.slice(strip));
    }
    parts.push({ kind: "code", block: { fence, info: info.trim(), code: codeLines.join("\n") } });
    proseLines = [""];
  }

  if (proseLines.length > 1 || parts.length === 0) parts.push(prose(proseLines));
  return parts;
}

/**
 * Renders a table cell from its parts on one line. A fence becomes
 * `<pre><code>`, a block, so the line breaks bordering it are dropped; its
 * lines join with `<br />` since a cell can't hold a raw newline, and
 * `<pre>` keeps their indentation. With `codeBelow`, fences are collected
 * there instead and the cell reads "(code below)".
 */
function renderCellParts(parts: CellPart[], codeBelow: CellCodeBlock[] | undefined): string {
  let cell = "";
  for (const [index, part] of parts.entries()) {
    if (part.kind === "code") {
      if (codeBelow) {
        codeBelow.push(part.block);
        cell += "(code below)";
      } else {
        cell += `<pre><code>${escapeCodeText(part.block.code).replace(NEWLINE_REGEX, "<br />")}</code></pre>`;
      }
      continue;
    }

    let text = part.text;
    if (!codeBelow) {
      if (parts[index - 1]?.kind === "code") text = text.replace(LEADING_NEWLINE_REGEX, "");
      if (parts[index + 1]?.kind === "code") text = text.replace(TRAILING_NEWLINE_REGEX, "");
    }
    cell += text.replace(PIPE_REGEX, "&#124;").replace(NEWLINE_REGEX, "<br />");
  }
  return cell;
}

/** Fenced code lifted out of a table's Description cells, keyed by row. */
export type CodeBelowTable = Array<{ label: string; blocks: CellCodeBlock[] }>;

/**
 * {@link formatDescriptionWithTags} for a table whose fenced code prints
 * below it: records the row's blocks under `label` in `below`.
 */
export function formatDescriptionWithCodeBelow(
  below: CodeBelowTable,
  label: string,
  description?: string,
  tags?: Array<{ name: string; body: string }>,
) {
  const blocks: CellCodeBlock[] = [];
  const cell = formatDescriptionWithTags(description, tags, blocks);
  if (blocks.length > 0) below.push({ label, blocks });
  return cell;
}

/** Real multi-line fenced blocks, each under a "Code for `label`:" line, for after a table. */
export function renderCodeBelowTable(below: CodeBelowTable): string {
  let out = "";
  for (const { label, blocks } of below) {
    out += `Code for \`${label}\`:\n\n`;
    for (const { fence, info, code } of blocks) {
      out += `${fence}${info}\n${code}${code ? "\n" : ""}${fence}\n\n`;
    }
  }
  return out;
}

export function formatPropType(type?: string) {
  if (type === undefined) return MD_TYPE_UNDEFINED;
  return codeCell(type);
}

/**
 * Type cell for a prop or module export. A re-export has no `type` of its
 * own, so it shows where the binding comes from as a `typeof import(...)`.
 */
export function formatExportType(prop: Pick<ComponentProp, "type" | "reExport">) {
  if (!prop.reExport) return formatPropType(prop.type);
  const { from, imported } = prop.reExport;
  const member =
    imported === "*" ? "" : IDENTIFIER_REGEX.test(imported) ? `.${imported}` : `[${JSON.stringify(imported)}]`;
  return formatPropType(`typeof import(${JSON.stringify(from)})${member}`);
}

function escapeHtml(text: string) {
  return text.replace(LT_REGEX, "&lt;").replace(GT_REGEX, "&gt;");
}

export function formatPropValue(value: string | undefined) {
  if (value === undefined) return MD_TYPE_UNDEFINED;
  return codeCell(value);
}

export function formatNameWithDeprecation(name: string, deprecated: DeprecatedValue | undefined): string {
  if (deprecated === undefined) return name;
  const suffix =
    typeof deprecated === "string" && deprecated.trim().length > 0
      ? `: ${escapeHtml(deprecated).replace(NEWLINE_REGEX, " ").replace(PIPE_REGEX, "&#124;")}`
      : "";
  return `<s>${name}</s><br />**Deprecated**${suffix}`;
}

/**
 * @param codeBelow When given, fenced code blocks are collected here and
 * the cell says "(code below)" in their place; otherwise they render inline.
 */
export function formatPropDescription(description: string | undefined, codeBelow?: CellCodeBlock[]) {
  if (description === undefined || description.trim().length === 0) return MD_TYPE_UNDEFINED;
  return renderCellParts(splitCodeFences(description), codeBelow);
}

export function formatSlotProps(props?: string) {
  if (props === undefined || props === "{}") return MD_TYPE_UNDEFINED;
  return formatPropType(formatTsProps(props).replace(NEWLINE_REGEX, " "));
}

export function formatSlotFallback(fallback?: string) {
  if (fallback === undefined) return MD_TYPE_UNDEFINED;
  return `<code>${escapeCodeText(fallback).replace(NEWLINE_REGEX, "<br />")}</code>`;
}

/**
 * The description, then one line per tag (`@since 1.2.0`), as one table
 * cell. See {@link formatPropDescription} for `codeBelow`.
 */
export function formatDescriptionWithTags(
  description?: string,
  tags?: Array<{ name: string; body: string }>,
  codeBelow?: CellCodeBlock[],
) {
  const parts: CellPart[] = [];
  const appendProse = (text: string) => {
    const last = parts.at(-1);
    if (last?.kind === "prose") last.text += text;
    else parts.push({ kind: "prose", text });
  };
  const appendSegment = (prefix: string, text: string) => {
    if (parts.length > 0) appendProse("\n");
    if (prefix) appendProse(prefix);
    for (const part of splitCodeFences(text)) {
      if (part.kind === "prose") appendProse(part.text);
      else parts.push(part);
    }
  };

  if (description !== undefined && description.trim().length > 0) appendSegment("", description);

  for (const { name, body } of tags ?? []) {
    const trimmed = body?.trim();
    appendSegment(trimmed ? `@${name} ` : `@${name}`, trimmed ?? "");
  }

  if (parts.length === 0) return MD_TYPE_UNDEFINED;
  return renderCellParts(parts, codeBelow);
}

export function formatEventDetail(detail?: string) {
  if (detail === undefined) return MD_TYPE_UNDEFINED;
  return formatPropType(detail.replace(NEWLINE_REGEX, " "));
}

/** `Extends <code>Base&lt;T></code>. Implements <code>Disposable</code>.`, or `undefined`. */
function classHeritageLine(moduleExport: ComponentProp): string | undefined {
  const parts = [
    moduleExport.extends ? `Extends ${formatPropType(moduleExport.extends)}.` : "",
    moduleExport.implements?.length
      ? `Implements ${moduleExport.implements.map((name) => formatPropType(name)).join(", ")}.`
      : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * A `#### \`Store\` members` table after the module exports table, for each
 * class module export with members. A class exported under several names
 * (`export { Store as Alias }`) gets one table, under its own name.
 */
export function renderClassMemberTables(
  document: { append(type: "h4" | "raw", raw?: string): unknown },
  moduleExports: ComponentProp[],
  options?: { codeBelow?: boolean },
) {
  const rendered = new Set<string>();
  for (const moduleExport of moduleExports) {
    if (moduleExport.kind !== "class") continue;
    const heritage = classHeritageLine(moduleExport);
    if (!moduleExport.members?.length && !heritage) continue;
    const className = moduleExport.localName ?? moduleExport.name;
    if (rendered.has(className)) continue;
    rendered.add(className);

    document.append("h4", `\`${className}\` members`);
    if (heritage) document.append("raw", `${heritage}\n\n`);
    if (!moduleExport.members?.length) continue;
    document.append("raw", CLASS_MEMBER_TABLE_HEADER);
    const below: CodeBelowTable = [];
    for (const member of moduleExport.members) {
      const description = options?.codeBelow
        ? formatDescriptionWithCodeBelow(below, member.name, member.description, member.tags)
        : formatDescriptionWithTags(member.description, member.tags);
      document.append(
        "raw",
        `| ${formatNameWithDeprecation(member.name, member.deprecated)} | ${formatPropType(formatClassMemberSignature(member))} | ${description} |\n`,
      );
    }
    document.append("raw", "\n");
    if (below.length > 0) document.append("raw", renderCodeBelowTable(below));
  }
}
