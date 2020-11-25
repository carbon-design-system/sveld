/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface MyTypedef {
  [key: string]: boolean;
}

export type MyTypedefArray = MyTypedef[];

export interface InputProps {
  /**
   * @default { ["1"]: true }
   */
  prop1?: MyTypedef;

  /**
   * @default []
   */
  prop2?: MyTypedefArray;
}

export default class Input extends SvelteComponent<
  InputProps,
  {},
  { default: { prop1: MyTypedef; prop2: MyTypedefArray } }
> {}
