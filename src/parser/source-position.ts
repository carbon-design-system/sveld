import type { SourcePosition, SourceRange } from "../ComponentParser";
import type { ParserContext } from "./context";

const NEWLINE_CR_REGEX = /[\r\n]+/g;

/**
 * Returns (and lazily computes/caches on `ctx`) the 0-based source offset for
 * the start of each line in `ctx.source`.
 */
export function getSourceLineStartOffsets(ctx: ParserContext) {
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

export function sourcePositionFromOffset(ctx: ParserContext, offset: number): SourcePosition | undefined {
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
 * Computes the {@link SourceRange} for a JSDoc tag within a parsed comment
 * block, given the block's own source lines and starting offset.
 */
export function sourceRangeFromCommentTag(
  ctx: ParserContext,
  blockSource: Array<{ number: number; source: string }>,
  tagSource: Array<{ number: number; source: string; tokens: { tag?: string } }> | undefined,
  blockStartOffset: number | undefined,
): SourceRange | undefined {
  if (!tagSource || tagSource.length === 0 || blockStartOffset === undefined) return undefined;

  const relevantTagSource = [...tagSource];
  while (relevantTagSource.length > 1) {
    const lastLine = relevantTagSource[relevantTagSource.length - 1];
    if (lastLine.tokens.tag || !lastLine.source.trim().endsWith("*/")) break;
    relevantTagSource.pop();
  }

  let tagLineOffset = blockStartOffset;
  for (let index = 0; index < relevantTagSource[0].number - 1; index++) {
    tagLineOffset += blockSource[index]?.source.length ?? 0;
    tagLineOffset += 1;
  }

  const tagLine = relevantTagSource[0];
  const tagColumn = tagLine.source.indexOf(tagLine.tokens.tag ?? "");
  const start = tagLineOffset + Math.max(tagColumn, 0);

  let end = blockStartOffset;
  const lastLine = relevantTagSource[relevantTagSource.length - 1];
  const lastLineNumber = lastLine.number;
  for (let index = 0; index < lastLineNumber - 1; index++) {
    end += blockSource[index]?.source.length ?? 0;
    end += 1;
  }
  end += lastLine.source.length;

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
