import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export type Author = string;

type RestProps = SvelteHTMLElements["blockquote"];

type $ComponentProps = {
  /**
   * @default ""
   */
  quote?: any;

  /**
   * @default ""
   */
  author?: Author;

  [key: `data-${string}`]: any;
};

export type QuoteProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class Quote extends SvelteComponentTyped<
  QuoteProps,
  Record<string, any>,
  { default: {} }
> {}
