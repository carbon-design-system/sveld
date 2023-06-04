/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export type Author = string;

export interface QuoteProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["blockquote"]> {
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
  {},
  { default: {} }
> {}
