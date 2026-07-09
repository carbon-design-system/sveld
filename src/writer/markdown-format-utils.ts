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
export const EXPORT_TABLE_HEADER = "| Name | Kind | Type | Description |\n| :- | :- | :- | :- |\n";

const PIPE_REGEX = /\|/g;
const LT_REGEX = /</g;
const GT_REGEX = />/g;
const NEWLINE_REGEX = /\n/g;

export function formatPropType(type?: string) {
  if (type === undefined) return MD_TYPE_UNDEFINED;
  return `<code>${type.replace(PIPE_REGEX, "&#124;")}</code>`;
}

export function escapeHtml(text: string) {
  return text.replace(LT_REGEX, "&lt;").replace(GT_REGEX, "&gt;");
}

export function formatPropValue(value: string | undefined) {
  if (value === undefined) return MD_TYPE_UNDEFINED;
  return `<code>${value.replace(BACKTICK_REGEX, "\\`").replace(PIPE_REGEX, "&#124;")}</code>`;
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
  return escapeHtml(description).replace(NEWLINE_REGEX, "<br />");
}

export function formatSlotProps(props?: string) {
  if (props === undefined || props === "{}") return MD_TYPE_UNDEFINED;
  return formatPropType(formatTsProps(props).replace(NEWLINE_REGEX, " "));
}

export function formatSlotFallback(fallback?: string) {
  if (fallback === undefined) return MD_TYPE_UNDEFINED;
  return formatPropType(escapeHtml(fallback).replace(NEWLINE_REGEX, "<br />"));
}

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

export function formatEventDetail(detail?: string) {
  if (detail === undefined) return MD_TYPE_UNDEFINED;
  return formatPropType(detail.replace(NEWLINE_REGEX, " "));
}
