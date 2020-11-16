/// <reference types="svelte" />

export interface LinkProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["a"]> {}

export default class Link {
  $$prop_def: LinkProps;
  $$slot_def: {
    default: {};
  };

  $on(eventname: "click", cb: (event: WindowEventMap["click"]) => void): () => void;
  $on(eventname: string, cb: (event: Event) => void): () => void;
}
