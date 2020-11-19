/// <reference types="svelte" />

export interface inputProps {}

export default class input {
  $$prop_def: inputProps;
  $$slot_def: {};

  $on(eventname: "KEY", cb: (event: CustomEvent<{ key: string }>) => void): () => void;
  $on(eventname: string, cb: (event: Event) => void): () => void;
}
