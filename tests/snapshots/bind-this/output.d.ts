/// <reference types="svelte" />

export interface inputProps {
  ref?: null | HTMLButtonElement;
}

export default class input {
  $$prop_def: inputProps;
  $$slot_def: {
    default: {};
  };

  $on(eventname: string, cb: (event: Event) => void): () => void;
}
