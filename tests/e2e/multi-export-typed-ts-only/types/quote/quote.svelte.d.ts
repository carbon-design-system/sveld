import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["blockquote"];

type $ComponentProps = {
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

export type QuoteProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class Quote extends SvelteComponentTyped<
  QuoteProps,
  Record<string, any>,
  { default: {} }
> {}
