/// <reference types="svelte" />

export interface inputProps {
  /**
   * prop1 description 1
   * prop1 description 2
   */
  prop1?: string;

  /**
   * prop2 description 1
   * prop2 description 2
   * @default null
   */
  prop2?: undefined;

  /**
   * @default 4
   */
  prop3?: 4 | "4";

  /**
   * @default "red"
   */
  prop4?: "red" | "blue";
}

export default class input {
  $$prop_def: inputProps;
  $$slot_def: {};

  $on(eventname: string, cb: (event: Event) => void): () => void;
}
