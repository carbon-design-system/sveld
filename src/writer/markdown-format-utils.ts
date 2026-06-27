import type { DeprecatedValue } from "../ComponentParser";
import { formatTsProps } from "./writer-ts-definitions-core";

export const BACKTICK_REGEX = /`/g;
export const WHITESPACE_REGEX = /\s+/g;

export const MD_TYPE_UNDEFINED = "--";

export const PROP_TABLE_HEADER =
  "| Prop name | Required | Kind | Reactive | Binding | Type | Default value | Description |\n| :- | :- | :- | :- | :- | :- | :- | :- |\n";
export const SLOT_TABLE_HEADER =
  "| Slot name | Default | Props | Fallback | Description |\n| :- | :- | :- | :- | :- |\n";
export const EVENT_TABLE_HEADER = "| Event name | Type | Detail | Description |\n| :- | :- | :- | :- |\n";

const PIPE_REGEX = /\|/g;
const LT_REGEX = /</g;
const GT_REGEX = />/g;
const NEWLINE_REGEX = /\n/g;

/**
 * Escape `|` and wrap a prop type for markdown table cells.
 *
 * @example
 * ```ts
 * formatPropType("string | number") // Returns: "<code>string &#124; number</code>"
 * formatPropType(undefined)         // Returns: "--"
 * ```
 */
export function formatPropType(type?: string) {
  if (type === undefined) return MD_TYPE_UNDEFINED;
  return `<code>${type.replace(PIPE_REGEX, "&#124;")}</code>`;
}

/**
 * Escape `<` and `>` for markdown output.
 *
 * @example
 * ```ts
 * escapeHtml("<div>") // Returns: "&lt;div&gt;"
 * ```
 */
export function escapeHtml(text: string) {
  return text.replace(LT_REGEX, "&lt;").replace(GT_REGEX, "&gt;");
}

/**
 * Format a default value for markdown table cells.
 *
 * @example
 * ```ts
 * formatPropValue("'hello'")  // Returns: "<code>'hello'</code>"
 * formatPropValue("`test`")   // Returns: "<code>\\`test\\`</code>"
 * ```
 */
export function formatPropValue(value: string | undefined) {
  if (value === undefined) return MD_TYPE_UNDEFINED;
  return `<code>${value.replace(BACKTICK_REGEX, "\\`").replace(PIPE_REGEX, "&#124;")}</code>`;
}

/**
 * Strike through deprecated prop, slot, and event names in markdown tables.
 *
 * @example
 * ```ts
 * formatNameWithDeprecation("size", "use width")
 * // Returns: "<s>size</s><br />**Deprecated**: use width"
 * ```
 */
export function formatNameWithDeprecation(name: string, deprecated: DeprecatedValue | undefined): string {
  if (deprecated === undefined) return name;
  const suffix =
    typeof deprecated === "string" && deprecated.trim().length > 0
      ? `: ${escapeHtml(deprecated).replace(NEWLINE_REGEX, " ").replace(PIPE_REGEX, "&#124;")}`
      : "";
  return `<s>${name}</s><br />**Deprecated**${suffix}`;
}

/**
 * Format a prop description; newlines become `<br />`.
 *
 * @example
 * ```ts
 * formatPropDescription("Line 1\nLine 2")
 * // Returns: "Line 1<br />Line 2"
 * ```
 */
export function formatPropDescription(description: string | undefined) {
  if (description === undefined || description.trim().length === 0) return MD_TYPE_UNDEFINED;
  return escapeHtml(description).replace(NEWLINE_REGEX, "<br />");
}

/**
 * Format slot props for markdown table cells.
 *
 * @example
 * ```ts
 * formatSlotProps("{ title: string }") // Returns: "<code>{ title: string }</code>"
 * formatSlotProps("{}")                 // Returns: "--"
 * ```
 */
export function formatSlotProps(props?: string) {
  if (props === undefined || props === "{}") return MD_TYPE_UNDEFINED;
  return formatPropType(formatTsProps(props).replace(NEWLINE_REGEX, " "));
}

/**
 * Format slot fallback content for markdown table cells.
 *
 * @example
 * ```ts
 * formatSlotFallback("<p>Default</p>")
 * // Returns: "<code>&lt;p&gt;Default&lt;/p&gt;</code>"
 * ```
 */
export function formatSlotFallback(fallback?: string) {
  if (fallback === undefined) return MD_TYPE_UNDEFINED;
  return formatPropType(escapeHtml(fallback).replace(NEWLINE_REGEX, "<br />"));
}

/**
 * Format a slot/snippet description plus pass-through JSDoc tags for markdown
 * table cells. Newlines become `<br />` and `<`, `>`, `|` are escaped so the
 * content stays inside a single table cell.
 *
 * @example
 * ```ts
 * formatSlotDescription("Header content.", [{ name: "since", body: "1.0.0" }])
 * // Returns: "Header content.<br />@since 1.0.0"
 * formatSlotDescription(undefined, [])
 * // Returns: "--"
 * ```
 */
export function formatSlotDescription(description?: string, tags?: Array<{ name: string; body: string }>) {
  const segments: string[] = [];

  if (description !== undefined && description.trim().length > 0) {
    segments.push(escapeHtml(description));
  }

  for (const { name, body } of tags ?? []) {
    const trimmed = body?.trim();
    segments.push(trimmed ? `@${name} ${escapeHtml(trimmed)}` : `@${name}`);
  }

  if (segments.length === 0) return MD_TYPE_UNDEFINED;

  return segments.join("\n").replace(PIPE_REGEX, "&#124;").replace(NEWLINE_REGEX, "<br />");
}

/**
 * Format event detail types for markdown table cells.
 *
 * @example
 * ```ts
 * formatEventDetail("{ value: string }")
 * // Returns: "<code>{ value: string }</code>"
 * ```
 */
export function formatEventDetail(detail?: string) {
  if (detail === undefined) return MD_TYPE_UNDEFINED;
  return formatPropType(detail.replace(NEWLINE_REGEX, " "));
}
