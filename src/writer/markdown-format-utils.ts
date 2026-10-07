import type { ComponentProp, DeprecatedValue } from "../model";
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
const CLASS_MEMBER_TABLE_HEADER = "| Member | Signature | Description |\n| :- | :- | :- |\n";
export const CSS_PART_TABLE_HEADER = "| Part name | Description |\n| :- | :- |\n";
export const CSS_PROPERTY_TABLE_HEADER =
  "| Property name | Type | Default value | Description |\n| :- | :- | :- | :- |\n";

const PIPE_REGEX = /\|/g;
const LT_REGEX = /</g;
const GT_REGEX = />/g;
const NEWLINE_REGEX = /\n/g;
const IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*$/;
const LINE_BREAK_REGEX = /\s*\n\s*/g;
// An entity-like `&`, a tag-opening `<`, `|`, a backtick, `*`, a backslash escape, or a word-edge `_`.
const CODE_ESCAPE_REGEX = /&(?=#?\w+;)|<(?=[A-Za-z/!?])|[|`*]|\\(?=[!-/:-@[-`{-~])|(?<![A-Za-z0-9])_|_(?![A-Za-z0-9])/g;
const CODE_ESCAPE_CHAR_REGEX = /[&<|`*\\_]/;

/**
 * Markdown still parses inside `<code>`: `<void>` would vanish as an unknown tag
 * and a backtick, `*`, or word-edge `_` would start a span. Encode only those.
 */
function escapeCodeText(text: string): string {
  if (!CODE_ESCAPE_CHAR_REGEX.test(text)) return text;
  return text.replace(CODE_ESCAPE_REGEX, (match) =>
    match === "&" ? "&amp;" : match === "<" ? "&lt;" : match === "_" ? "&#95;" : `&#${match.charCodeAt(0)};`,
  );
}

/** A `<code>` table cell; a multi-line type or value joins onto one line so it can't split the row. */
function codeCell(text: string): string {
  return `<code>${escapeCodeText(text.includes("\n") ? text.replace(LINE_BREAK_REGEX, " ") : text)}</code>`;
}

const JSDOC_LINK_REGEX = /\{@link\s+([^{}\s|]+)(?:\|([^{}]+))?\}/g;

/** `{@link target|text}` to `[text](target)`. JSON and `.d.ts` keep the tag verbatim. */
function rewriteJsDocLinks(text: string): string {
  if (!text.includes("{@link")) return text;
  return text.replace(JSDOC_LINK_REGEX, (_match, target: string, label: string | undefined) => {
    const linkText = label === undefined ? target : label.trim();
    return `[${linkText}](${target})`;
  });
}

/**
 * Prose is already HTML-escaped with `{@link}` rewritten; pipes and newlines are left for {@link renderCellParts}.
 * Code is a fenced block's content, verbatim.
 */
type CellPart = { kind: "prose"; text: string } | { kind: "code"; code: string };

function hasCodeFence(text: string): boolean {
  return text.includes("```") || text.includes("~~~");
}

function proseText(text: string): string {
  return escapeHtml(rewriteJsDocLinks(text));
}

const FENCE_OPEN_REGEX = /^([ \t]*)(`{3,}|~{3,})(.*)$/;
const LEADING_NEWLINE_REGEX = /^\n/;
const TRAILING_NEWLINE_REGEX = /\n$/;

/**
 * Splits text on fenced code blocks, CommonMark-style (a closing fence is the same
 * marker at least as long; unclosed runs to the end; code loses up to the opening
 * fence's indent). Prose parts keep the line breaks bordering a fence.
 */
function splitCodeFences(text: string): CellPart[] {
  const prose = (lines: string[]): CellPart => ({ kind: "prose", text: proseText(lines.join("\n")) });
  if (!hasCodeFence(text)) return [prose([text])];

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
    parts.push({ kind: "code", code: codeLines.join("\n") });
    proseLines = [""];
  }

  if (proseLines.length > 1 || parts.length === 0) parts.push(prose(proseLines));
  return parts;
}

/**
 * One-line table cell. A fence becomes a `<pre><code>` block, so its bordering
 * line breaks drop; a cell can't hold a raw newline, so lines join with `<br />`.
 */
function renderCellParts(parts: CellPart[]): string {
  let cell = "";
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (part.kind === "code") {
      cell += `<pre><code>${escapeCodeText(part.code).replace(NEWLINE_REGEX, "<br />")}</code></pre>`;
      continue;
    }

    let text = part.text;
    if (parts[index - 1]?.kind === "code") text = text.replace(LEADING_NEWLINE_REGEX, "");
    if (parts[index + 1]?.kind === "code") text = text.replace(TRAILING_NEWLINE_REGEX, "");
    cell += text.replace(PIPE_REGEX, "&#124;").replace(NEWLINE_REGEX, "<br />");
  }
  return cell;
}

export function formatPropType(type?: string) {
  if (type === undefined) return MD_TYPE_UNDEFINED;
  return codeCell(type);
}

/** A re-export has no `type` of its own, so it shows `typeof import(...)` instead. */
export function formatExportType(prop: Pick<ComponentProp, "type" | "reExport">) {
  if (!prop.reExport) return formatPropType(prop.type);
  const { from, imported } = prop.reExport;
  const member =
    imported === "*" ? "" : IDENTIFIER_REGEX.test(imported) ? `.${imported}` : `[${JSON.stringify(imported)}]`;
  return formatPropType(`typeof import(${JSON.stringify(from)})${member}`);
}

function escapeHtml(text: string) {
  if (!text.includes("<") && !text.includes(">")) return text;
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

export function formatPropDescription(description: string | undefined) {
  if (description === undefined || description.trim().length === 0) return MD_TYPE_UNDEFINED;
  return renderCellParts(splitCodeFences(description));
}

export function formatSlotProps(props?: string) {
  if (props === undefined || props === "{}") return MD_TYPE_UNDEFINED;
  return formatPropType(formatTsProps(props).replace(NEWLINE_REGEX, " "));
}

export function formatSlotFallback(fallback?: string) {
  if (fallback === undefined) return MD_TYPE_UNDEFINED;
  return `<code>${escapeCodeText(fallback).replace(NEWLINE_REGEX, "<br />")}</code>`;
}

/** The description, then one line per tag (`@since 1.2.0`), as one table cell. */
export function formatDescriptionWithTags(description?: string, tags?: Array<{ name: string; body: string }>) {
  const hasDescription = description !== undefined && description.trim().length > 0;
  if (!(hasDescription && hasCodeFence(description)) && !tags?.some(({ body }) => body && hasCodeFence(body))) {
    const segments = hasDescription ? [proseText(description)] : [];
    for (const { name, body } of tags ?? []) {
      const trimmed = body?.trim();
      segments.push(trimmed ? `@${name} ${proseText(trimmed)}` : `@${name}`);
    }
    if (segments.length === 0) return MD_TYPE_UNDEFINED;
    return segments.join("\n").replace(PIPE_REGEX, "&#124;").replace(NEWLINE_REGEX, "<br />");
  }

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

  if (hasDescription) appendSegment("", description);

  for (const { name, body } of tags ?? []) {
    const trimmed = body?.trim();
    appendSegment(trimmed ? `@${name} ` : `@${name}`, trimmed ?? "");
  }

  if (parts.length === 0) return MD_TYPE_UNDEFINED;
  return renderCellParts(parts);
}

export function formatEventDetail(detail?: string) {
  if (detail === undefined) return MD_TYPE_UNDEFINED;
  return formatPropType(detail.replace(NEWLINE_REGEX, " "));
}

/** `Extends <code>Base&lt;T></code>. Implements <code>Disposable</code>.` */
function classHeritageLine(moduleExport: ComponentProp): string | undefined {
  const parts = [
    moduleExport.extends ? `Extends ${formatPropType(moduleExport.extends)}.` : "",
    moduleExport.implements?.length
      ? `Implements ${moduleExport.implements.map((name) => formatPropType(name)).join(", ")}.`
      : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** A class exported under several names (`export { Store as Alias }`) gets one table, under its own name. */
export function renderClassMemberTables(
  document: { append(type: "h4" | "raw", raw?: string): unknown },
  moduleExports: ComponentProp[],
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
    for (const member of moduleExport.members) {
      document.append(
        "raw",
        `| ${formatNameWithDeprecation(member.name, member.deprecated)} | ${formatPropType(formatClassMemberSignature(member))} | ${formatDescriptionWithTags(member.description, member.tags)} |\n`,
      );
    }
    document.append("raw", "\n");
  }
}
