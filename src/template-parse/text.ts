import type { AST } from "svelte/compiler";
import type { TemplateParserState } from "./state";

/**
 * From svelte's `phases/1-parse/state/text.js`, minus entity decoding.
 * Nothing reads a body `Text` node's `.data`. Slot fallback is a raw source
 * span by offset. So `.data` is aliased to `.raw`. Attribute-value chunks
 * in `elements.ts` still decode.
 */
export function readText(state: TemplateParserState): void {
  const start = state.index;
  const source = state.source;

  // `indexOf` (SIMD memchr) instead of a per-char loop.
  const angle = source.indexOf("<", start);
  const brace = source.indexOf("{", start);
  let end: number;
  if (angle === -1) {
    end = brace === -1 ? source.length : brace;
  } else {
    end = brace === -1 ? angle : Math.min(angle, brace);
  }
  state.index = end;

  const raw = source.slice(start, end);

  const node: AST.Text = { type: "Text", start, end: state.index, raw, data: raw };

  state.append(node);
}
