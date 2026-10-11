import { createLocator } from "sveast/walk";
import { isObject } from "../ast-guards";
import type { SourcePosition, SourceRange } from "../model";
import type { ParserContext } from "./context";

export const NEWLINE_CR_REGEX = /[\r\n]+/g;

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

/** `nodeSourceText` with newlines folded to spaces. */
export function sourceForExpression(ctx: ParserContext, node: unknown) {
  return nodeSourceText(ctx, node)?.replace(NEWLINE_CR_REGEX, " ");
}
