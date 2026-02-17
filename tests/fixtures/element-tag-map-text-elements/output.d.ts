import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["abbr"] &
  SvelteHTMLElements["code"] &
  SvelteHTMLElements["em"] &
  SvelteHTMLElements["strong"] &
  SvelteHTMLElements["mark"] &
  SvelteHTMLElements["kbd"] &
  SvelteHTMLElements["samp"] &
  SvelteHTMLElements["var"];

type $Props = {
  /**
   * @default "code"
   */
  textElement?: "abbr" | "code" | "em" | "strong" | "mark" | "kbd" | "samp" | "var";

  [key: `data-${string}`]: unknown;
};

export type ElementTagMapTextElementsProps = Omit<$RestProps, keyof $Props> & $Props;

export default class ElementTagMapTextElements extends SvelteComponentTyped<
  ElementTagMapTextElementsProps,
  Record<string, any>,
  Record<string, never>
> {}
