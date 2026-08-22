import type { AST } from "svelte/compiler";
import type { TemplateParserState } from "./state";

/**
 * `<style>` is not parsed as CSS. sveld only uses `Root.css.start`/`.end` to
 * skip that range when scanning JSDoc. `children`/`comments`/`content` are
 * empty placeholders. The shim test drops them.
 *
 * A literal `</style` inside a CSS string or comment will fool this. svelte's
 * `read_style` is CSS-aware. This isn't.
 */
export function readStyle(state: TemplateParserState, start: number, attributes: AST.Attribute[]): AST.CSS.StyleSheet {
  const contentStart = state.index;
  const closeIndex = state.source.indexOf("</style", state.index);
  const contentEnd = closeIndex === -1 ? state.source.length : closeIndex;
  state.index = contentEnd;

  state.eat("</style", true);
  state.read(/\s*>/y);

  return {
    type: "StyleSheet",
    start,
    end: state.index,
    attributes,
    children: [],
    comments: [],
    content: {
      start: contentStart,
      end: contentEnd,
      styles: state.source.slice(contentStart, contentEnd),
      comment: null,
    },
  } as unknown as AST.CSS.StyleSheet;
}
