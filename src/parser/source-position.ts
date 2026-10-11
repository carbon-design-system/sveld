import type { AST } from "sveast";
import { createLocator, walk } from "sveast/walk";
import { isObject } from "../ast-guards";
import type { SourcePosition, SourceRange } from "../model";
import type { ParserContext } from "./context";

/** Line breaks plus the indentation around them. */
const LINE_BREAKS_WITH_INDENT_REGEX = /[^\S\r\n]*[\r\n]+\s*/g;

function sourcePositionFromOffset(ctx: ParserContext, offset: number): SourcePosition | undefined {
  if (!ctx.source || offset < 0 || offset > ctx.source.length) return undefined;
  ctx.sourceLocator ??= createLocator(ctx.source);
  return ctx.sourceLocator(offset);
}

export function sourceRangeFromOffsets(
  ctx: ParserContext,
  start: number | undefined,
  end: number | undefined,
): SourceRange | undefined {
  if (start === undefined || end === undefined || end < start) return undefined;

  const startPosition = sourcePositionFromOffset(ctx, start);
  const endPosition = sourcePositionFromOffset(ctx, end);
  if (!startPosition || !endPosition) return undefined;

  return { start: startPosition, end: endPosition };
}

function nodeOffsets(node: unknown): { start?: number; end?: number } {
  if (!isObject(node)) return {};
  return {
    start: typeof node.start === "number" ? node.start : undefined,
    end: typeof node.end === "number" ? node.end : undefined,
  };
}

export function sourceRangeFromNode(ctx: ParserContext, node: unknown) {
  const { start, end } = nodeOffsets(node);
  return sourceRangeFromOffsets(ctx, start, end);
}

/** A JSDoc tag's range, from its comment lines (each carrying its absolute offset). */
export function sourceRangeFromCommentTag(
  ctx: ParserContext,
  tagLines: Array<{ start: number; raw: string; tag?: string }> | undefined,
): SourceRange | undefined {
  if (!tagLines || tagLines.length === 0) return undefined;

  // A trailing line that's just the block's closing `*/` isn't part of the tag.
  const relevantLines = [...tagLines];
  while (relevantLines.length > 1) {
    const lastLine = relevantLines[relevantLines.length - 1];
    if (lastLine.tag !== undefined || !lastLine.raw.trim().endsWith("*/")) break;
    relevantLines.pop();
  }

  const firstLine = relevantLines[0];
  const tagColumn = firstLine.raw.indexOf(`@${firstLine.tag ?? ""}`);
  const start = firstLine.start + Math.max(tagColumn, 0);

  const lastLine = relevantLines[relevantLines.length - 1];
  const end = lastLine.start + lastLine.raw.length;

  return sourceRangeFromOffsets(ctx, start, end);
}

export function sourceAtPos(ctx: ParserContext, start: number, end: number) {
  return ctx.source?.slice(start, end);
}

export function nodeSourceText(ctx: ParserContext, node: unknown) {
  const { start, end } = nodeOffsets(node);
  if (start === undefined || end === undefined) return undefined;
  return sourceAtPos(ctx, start, end);
}

/** A run of whitespace. */
const WHITESPACE_RUN_REGEX = /\s+/g;

/** `nodeSourceText` on one line: each line break and its indentation become one space. */
export function sourceForExpression(ctx: ParserContext, node: unknown) {
  return nodeSourceText(ctx, node)?.replace(LINE_BREAKS_WITH_INDENT_REGEX, " ");
}

/** The spaces and tabs a line starts with. */
const LEADING_INDENT_REGEX = /^[ \t]*/;
/** A line break inside a template literal's text. */
const TEMPLATE_LINE_BREAK_REGEX = /\r?\n/g;

/**
 * `node`'s source as a default's text: comments dropped, laid out as written
 * (line breaks kept, indentation relative to the line it starts on), other
 * whitespace runs collapsed. String, template, and regex literals stay as
 * written, a template's line break as `\n`. Comments and literals come from
 * the AST, not a rescan of the text, so `/\/\//` or `/"/` isn't misread as a
 * comment or a string. Writers that need one line fold the line breaks.
 */
export function defaultSourceText(ctx: ParserContext, node: unknown) {
  const { source } = ctx;
  const { start, end } = nodeOffsets(node);
  if (source === undefined || start === undefined || end === undefined) return undefined;

  // `text` is a literal's, kept as is; a segment without one is a comment.
  const segments: Array<{ start: number; end: number; text?: string }> = [];
  for (const comment of ctx.parsed?.comments ?? []) {
    if (comment.start >= start && comment.end <= end) segments.push({ start: comment.start, end: comment.end });
  }
  walk(node as AST.SvelteNode, {
    enter(child) {
      if (child.type === "TemplateElement") {
        const text = source.slice(child.start, child.end).replace(TEMPLATE_LINE_BREAK_REGEX, "\\n");
        segments.push({ start: child.start, end: child.end, text });
      } else if (child.type === "Literal" && (typeof child.value === "string" || "regex" in child)) {
        segments.push({ start: child.start, end: child.end, text: source.slice(child.start, child.end) });
      }
    },
  });
  segments.sort((a, b) => a.start - b.start);

  // A whitespace run with a line break keeps the break and the next line's indentation.
  const layOut = (text: string) =>
    text.replace(WHITESPACE_RUN_REGEX, (run) => (run.includes("\n") ? run.slice(run.lastIndexOf("\n")) : " "));

  let text = "";
  let between = "";
  let cursor = start;
  for (const segment of segments) {
    between += source.slice(cursor, segment.start);
    cursor = segment.end;
    // A comment reads as a space, so it can't join the tokens on either side.
    if (segment.text === undefined) {
      between += " ";
      continue;
    }
    text += layOut(between) + segment.text;
    between = "";
  }
  text += layOut(between + source.slice(cursor, end));

  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  const baseIndent = LEADING_INDENT_REGEX.exec(source.slice(lineStart, start))?.[0] ?? "";
  return text
    .split("\n")
    .map((line, index) => (index > 0 && line.startsWith(baseIndent) ? line.slice(baseIndent.length) : line).trimEnd())
    .filter((line, index) => index === 0 || line !== "")
    .join("\n")
    .trim();
}
