import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["blockquote"];

export type QuoteProps = RestProps & {
  /**
   * @default ""
   */
  quote?: string;

  /**
   * @default ""
   */
  author?: string;

  [key: `data-${string}`]: any;
};

export default class Quote extends SvelteComponentTyped<
  QuoteProps,
  Record<string, any>,
  { default: {} }
> {}
