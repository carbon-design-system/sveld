/// <reference types="svelte" />

export interface inputProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["h1"]> {}

export default class input {
  $$prop_def: inputProps;
  $$slot_def: {};

  $on(eventname: string, cb: (event: Event) => void): () => void;
}
