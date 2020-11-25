/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface QuoteProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["blockquote"]> {
  /**
   * @default ""
   */
  quote?: string;

  /**
   * @default ""
   */
  author?: string;
}

export default class Quote extends SvelteComponent<QuoteProps, {}, { default: {} }> {}
