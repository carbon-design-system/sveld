import type { SvelteComponentTyped } from "svelte";

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

export default class Input extends SvelteComponentTyped<
  InputProps,
  Record<string, any>,
  { default: { prop1: MyTypedef; prop2: MyTypedefArray } }
> {}
