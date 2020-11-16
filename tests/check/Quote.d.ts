/// <reference types="svelte" />

export interface QuoteProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["blockquote"]> {
  /**
   * @default ''
   */
  quote?: string;

  /**
   * @default ''
   */
  author?: string;

  ref?: HTMLElement;
}

export default class Quote {
  $$prop_def: QuoteProps;
  $$slot_def: {
    default: {};
  };

  $on(eventname: "load", cb: (event: CustomEvent<{ mount: boolean }>) => void): () => void;
  $on(eventname: string, cb: (event: Event) => void): () => void;
}
