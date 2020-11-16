/// <reference types="svelte" />

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

export default class Quote {
  $$prop_def: QuoteProps;
  $$slot_def: {
    default: {};
  };

  $on(eventname: string, cb: (event: Event) => void): () => void;
}
