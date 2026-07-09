import type { Component } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["article"] & SvelteHTMLElements["section"] & SvelteHTMLElements["nav"] & SvelteHTMLElements["main"] & SvelteHTMLElements["header"] & SvelteHTMLElements["footer"];

type $Props = {
  /**
   * @default "article"
   */
  semanticTag?: "article" | "section" | "nav" | "main" | "header" | "footer";

  [key: `data-${string}`]: unknown;
};

export type ElementTagMapNewProps = Omit<$RestProps, keyof $Props> & $Props;

export type ElementTagMapNewExports = Record<string, never>;

declare const ElementTagMapNew: Component<
  ElementTagMapNewProps,
  ElementTagMapNewExports,
  ""
>;
export default ElementTagMapNew;
