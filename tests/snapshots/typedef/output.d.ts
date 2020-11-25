/// <reference types="svelte" />

export interface MyTypedef {
  [key: string]: boolean;
}

export interface inputProps {
  /**
   * @default "id-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * @default { ["1"]: true }
   */
  prop1?: MyTypedef;
}

export default class input {
  $$prop_def: inputProps;
  $$slot_def: {
    default: { prop1: MyTypedef };
  };

  $on(eventname: string, cb: (event: Event) => void): () => void;
}
