import type { AST } from "svelte/compiler";
import { readElement } from "./elements";
import { readOptions } from "./read-options";
import { TemplateParserState } from "./state";
import { readTag } from "./tag";
import { readText } from "./text";

/**
 * Top-level dispatch. From svelte's `Parser` constructor (`phases/1-parse/index.js`).
 *
 * Trailing whitespace is trimmed first, matching svelte, so offsets are
 * against the trimmed source. `Root.end` is still the original length,
 * set in `state.ts`.
 *
 * Not a full `AST.Root`. Omitted fields (`name_loc`, expression `.loc`,
 * `SnippetBlock.parameters`/`.typeParams`, body-text entity decoding,
 * `trailingComments`) keep the return type `unknown`. The shim test strips
 * the same fields before comparing.
 */
export function parse(source: string): unknown {
  const trimmed = source.trimEnd();
  const state = new TemplateParserState(trimmed, source.length);

  while (state.index < state.source.length) {
    if (state.match("<")) {
      readElement(state);
    } else if (state.match("{")) {
      readTag(state);
    } else {
      readText(state);
    }
  }

  // `<svelte:options>` is parsed as a normal root-only element, then moved
  // into `Root.options` here. Same splice-then-`read_options` as svelte.
  const optionsIndex = state.root.fragment.nodes.findIndex((node) => node.type === "SvelteOptions");
  if (optionsIndex !== -1) {
    const [optionsNode] = state.root.fragment.nodes.splice(optionsIndex, 1);
    state.root.options = readOptions(
      optionsNode as unknown as { start: number; end: number; attributes: AST.Attribute[] },
    );
  }

  return state.root;
}
