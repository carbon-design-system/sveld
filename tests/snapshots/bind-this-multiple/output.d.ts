/// <reference types="svelte" />

export interface inputProps {
  ref?: null | HTMLButtonElement | HTMLHeadingElement;

  ref2?: null | HTMLDivElement;

  /**
   * @default false
   */
  propBool?: boolean;
}

export default class input {
  $$prop_def: inputProps;
  $$slot_def: {
    default: {};
  };

  $on(eventname: string, cb: (event: Event) => void): () => void;
}
