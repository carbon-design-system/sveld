/// <reference types="svelte" />

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

export default class Quote {
  $$prop_def: QuoteProps;
  $$slot_def: {
    default: {};
  };

  $on(eventname: string, cb: (event: Event) => void): () => void;
}
