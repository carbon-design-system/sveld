import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["article"] &
  SvelteHTMLElements["section"] &
  SvelteHTMLElements["nav"] &
  SvelteHTMLElements["main"] &
  SvelteHTMLElements["header"] &
  SvelteHTMLElements["footer"];

type $Props = {
  /**
   * @default "article"
   */
  semanticTag?: "article" | "section" | "nav" | "main" | "header" | "footer";

  [key: `data-${string}`]: any;
};

export type ElementTagMapNewProps = Omit<$RestProps, keyof $Props> & $Props;

export default class ElementTagMapNew extends SvelteComponentTyped<
  ElementTagMapNewProps,
  Record<string, any>,
  Record<string, never>
> {}
