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

export function formatPropDescription(description: string | undefined) {
  if (description === undefined || description.trim().length === 0) return MD_TYPE_UNDEFINED;
  return escapeHtml(rewriteJsDocLinks(description)).replace(PIPE_REGEX, "&#124;").replace(NEWLINE_REGEX, "<br />");
}

export function formatSlotProps(props?: string) {
  if (props === undefined || props === "{}") return MD_TYPE_UNDEFINED;
  return formatPropType(formatTsProps(props).replace(NEWLINE_REGEX, " "));
}

export function formatSlotFallback(fallback?: string) {
  if (fallback === undefined) return MD_TYPE_UNDEFINED;
  return `<code>${escapeCodeText(fallback).replace(NEWLINE_REGEX, "<br />")}</code>`;
}

export function formatDescriptionWithTags(description?: string, tags?: Array<{ name: string; body: string }>) {
  const segments: string[] = [];

  if (description !== undefined && description.trim().length > 0) {
    segments.push(escapeHtml(rewriteJsDocLinks(description)));
  }

  for (const { name, body } of tags ?? []) {
    const trimmed = body?.trim();
    segments.push(trimmed ? `@${name} ${escapeHtml(rewriteJsDocLinks(trimmed))}` : `@${name}`);
  }

  if (segments.length === 0) return MD_TYPE_UNDEFINED;

  return segments.join("\n").replace(PIPE_REGEX, "&#124;").replace(NEWLINE_REGEX, "<br />");
}

export function formatEventDetail(detail?: string) {
  if (detail === undefined) return MD_TYPE_UNDEFINED;
  return formatPropType(detail.replace(NEWLINE_REGEX, " "));
}

/**
 * A `#### \`Store\` members` table after the module exports table, for each
 * class module export with members. A class exported under several names
 * (`export { Store as Alias }`) gets one table, under its own name.
 */
export function renderClassMemberTables(
  document: { append(type: "h4" | "raw", raw?: string): unknown },
  moduleExports: ComponentProp[],
) {
  const rendered = new Set<string>();
  for (const moduleExport of moduleExports) {
    if (moduleExport.kind !== "class" || !moduleExport.members?.length) continue;
    const className = moduleExport.localName ?? moduleExport.name;
    if (rendered.has(className)) continue;
    rendered.add(className);

    document.append("h4", `\`${className}\` members`);
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
