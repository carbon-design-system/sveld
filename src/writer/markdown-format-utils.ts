import { formatTsProps } from "./writer-ts-definitions-core";

export const BACKTICK_REGEX = /`/g;
export const WHITESPACE_REGEX = /\s+/g;

export const MD_TYPE_UNDEFINED = "--";

export const PROP_TABLE_HEADER =
  "| Prop name | Required | Kind | Reactive | Type | Default value | Description |\n| :- | :- | :- | :- |\n";
export const SLOT_TABLE_HEADER = "| Slot name | Default | Props | Fallback |\n| :- | :- | :- | :- |\n";
export const EVENT_TABLE_HEADER = "| Event name | Type | Detail | Description |\n| :- | :- | :- | :- |\n";

const PIPE_REGEX = /\|/g;
const LT_REGEX = /</g;
const GT_REGEX = />/g;
const NEWLINE_REGEX = /\n/g;

/**
 * Formats a prop type for display in markdown tables.
 *
 * Escapes pipe characters to prevent breaking markdown table syntax
 * and wraps the type in a code block.
 *
 * @param type - The type string to format
 * @returns Formatted type string or MD_TYPE_UNDEFINED if type is undefined
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
 * Escapes HTML special characters in text.
 *
 * Converts `<` to `&lt;` and `>` to `&gt;` to prevent HTML injection
 * and ensure proper rendering in markdown.
 *
 * @param text - The text to escape
 * @returns The escaped text
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
 * Formats a prop default value for display in markdown tables.
 *
 * Escapes backticks and pipe characters, and wraps the value in a code block.
 *
 * @param value - The default value string to format
 * @returns Formatted value string or MD_TYPE_UNDEFINED if value is undefined
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
 * Formats a prop description for display in markdown tables.
 *
 * Escapes HTML characters and converts newlines to `<br />` tags
 * for proper rendering in markdown tables.
 *
 * @param description - The description string to format
 * @returns Formatted description or MD_TYPE_UNDEFINED if description is empty
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
 * Formats slot props for display in markdown tables.
 *
 * Converts TypeScript type definitions to a single-line format
 * and wraps them in a code block. Returns MD_TYPE_UNDEFINED for
 * empty or undefined props.
 *
 * @param props - The slot props type string
 * @returns Formatted props string or MD_TYPE_UNDEFINED
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
 * Formats slot fallback content for display in markdown tables.
 *
 * Escapes HTML and converts newlines to `<br />` tags, then wraps
 * in a code block.
 *
 * @param fallback - The fallback content string
 * @returns Formatted fallback string or MD_TYPE_UNDEFINED if undefined
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
 * Formats event detail type for display in markdown tables.
 *
 * Converts the detail type to a single-line format and wraps it
 * in a code block.
 *
 * @param detail - The event detail type string
 * @returns Formatted detail string or MD_TYPE_UNDEFINED if undefined
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
