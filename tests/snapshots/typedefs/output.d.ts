/// <reference types="svelte" />

export interface MyTypedef {
  [key: string]: boolean;
}

export type MyTypedefArray = MyTypedef[];

export interface inputProps {
  /**
   * @default { ["1"]: true }
   */
  prop1?: MyTypedef;

  /**
   * @default []
   */
  prop2?: MyTypedefArray;
}

export default class input {
  $$prop_def: inputProps;
  $$slot_def: {
    default: { prop1: MyTypedef; prop2: MyTypedefArray };
  };

  $on(eventname: string, cb: (event: Event) => void): () => void;
}
