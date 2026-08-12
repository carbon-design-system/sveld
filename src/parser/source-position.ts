import type { SourcePosition, SourceRange } from "../ComponentParser";
import type { ParserContext } from "./context";

/** Matches one or more consecutive `\r`/`\n` so multiline source can collapse to a single space. */
export const NEWLINE_CR_REGEX = /[\r\n]+/g;

/**
 * Returns (and lazily computes/caches on `ctx`) the 0-based source offset for
 * the start of each line in `ctx.source`.
 */
function getSourceLineStartOffsets(ctx: ParserContext) {
  if (ctx.sourceLineStartOffsetsCache) return ctx.sourceLineStartOffsetsCache;

  const offsets = [0];
  if (ctx.source) {
    for (let index = 0; index < ctx.source.length; index++) {
      if (ctx.source[index] === "\n") {
        offsets.push(index + 1);
      }
    }
  }

  ctx.sourceLineStartOffsetsCache = offsets;
  return offsets;
}

function sourcePositionFromOffset(ctx: ParserContext, offset: number): SourcePosition | undefined {
  if (!ctx.source || offset < 0 || offset > ctx.source.length) return undefined;

  const offsets = getSourceLineStartOffsets(ctx);
  let low = 0;
  let high = offsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const lineStart = offsets[mid];
    const nextLineStart = offsets[mid + 1] ?? Number.POSITIVE_INFINITY;

    if (offset < lineStart) {
      high = mid - 1;
    } else if (offset >= nextLineStart) {
      low = mid + 1;
    } else {
      return {
        line: mid + 1,
        column: offset - lineStart,
      };
    }
  }

  return undefined;
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

  return {
    start: startPosition,
    end: endPosition,
  };
}

export function sourceRangeFromNode(ctx: ParserContext, node: unknown) {
  if (!node || typeof node !== "object") return undefined;
  const start = "start" in node && typeof node.start === "number" ? node.start : undefined;
  const end = "end" in node && typeof node.end === "number" ? node.end : undefined;
  return sourceRangeFromOffsets(ctx, start, end);
}

/**
 * Computes the {@link SourceRange} for a JSDoc tag, given that tag's own comment lines (each
 * already carrying its absolute offset in the source - see `./comment-parser.ts`).
 */
export function sourceRangeFromCommentTag(
  ctx: ParserContext,
  tagLines: Array<{ start: number; raw: string; tag?: string }> | undefined,
): SourceRange | undefined {
  if (!tagLines || tagLines.length === 0) return undefined;

  // A trailing line that's purely the block's closing `*/` (not itself a tag boundary) isn't
  // part of this tag's own text - drop it before computing the range's end.
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

export function sourceForExpression(ctx: ParserContext, node: unknown) {
  if (!node || typeof node !== "object") return undefined;
  const start = "start" in node && typeof node.start === "number" ? node.start : undefined;
  const end = "end" in node && typeof node.end === "number" ? node.end : undefined;
  if (start === undefined || end === undefined) return undefined;
  return sourceAtPos(ctx, start, end)?.replace(NEWLINE_CR_REGEX, " ");
}
