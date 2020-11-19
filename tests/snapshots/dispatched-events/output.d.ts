/// <reference types="svelte" />

export interface inputProps {}

export default class input {
  $$prop_def: inputProps;
  $$slot_def: {
    default: {};
  };

  $on(eventname: "hover", cb: (event: CustomEvent<any>) => void): () => void;
  $on(eventname: "destroy", cb: (event: CustomEvent<any>) => void): () => void;
  $on(eventname: string, cb: (event: Event) => void): () => void;
}
