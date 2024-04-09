import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export type Author = string;

type RestProps = SvelteHTMLElements["blockquote"];

export interface QuoteProps extends RestProps {
  /**
   * @default ""
   */
  quote?: any;

  /**
   * @default ""
   */
  author?: Author;

  [key: `data-${string}`]: any;
}

export default class Quote extends SvelteComponentTyped<
  QuoteProps,
  Record<string, any>,
  { default: {} }
> {}
