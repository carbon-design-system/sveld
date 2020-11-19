/// <reference types="svelte" />

export interface inputProps {
  /**
   * @default null
   */
  ref?: undefined;

  /**
   * @default true
   */
  propBool?: boolean;

  /**
   * @default ""
   */
  propString?: string;

  name?: undefined;

  /**
   * @default "" + Math.random().toString(36)
   */
  id?: string;

  /**
   * @constant
   * @default { ["1"]: true }
   */
  propConst?: { ["1"]: true };

  /**
   * @default () => { localBool = !localBool; }
   */
  fn?: () => any;
}

export default class input {
  $$prop_def: inputProps;
  $$slot_def: {
    default: {};
  };

  $on(eventname: string, cb: (event: Event) => void): () => void;
}
