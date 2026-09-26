import type { AST } from "svelte/compiler";
import { readElement } from "./elements";
import { readOptions } from "./read-options";
import { TemplateParserState, type TemplateRoot } from "./state";
import { readTag } from "./tag";
import { readText } from "./text";

export type { TemplateAstNode, TemplateRoot, TemplateScript } from "./state";

/**
 * Top-level dispatch. From svelte's `Parser` constructor (`phases/1-parse/index.js`).
 *
 * Trailing whitespace is trimmed first, matching svelte, so offsets are
 * against the trimmed source. `Root.end` is still the original length,
 * set in `state.ts`.
 *
 * Returns svelte's `AST.Root`, with the differences listed on {@link TemplateRoot}.
 */
export function parse(source: string): TemplateRoot {
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
