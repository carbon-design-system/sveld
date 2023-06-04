/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface QuoteProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["blockquote"]> {
  /**
   * @default ""
   */
  quote?: string;

  /**
   * @default ""
   */
  author?: string;

  [key: `data-${string}`]: any;
}

export default class Quote extends SvelteComponentTyped<
  QuoteProps,
  {},
  { default: {} }
> {}
