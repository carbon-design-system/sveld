/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export type Author = string;

export interface QuoteProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["blockquote"]> {
  /**
   * @default ""
   */
  quote?: any;

  /**
   * @default ""
   */
  author?: Author;
}

export default class Quote extends SvelteComponent<QuoteProps, {}, { default: {} }> {}
