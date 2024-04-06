import type { SvelteComponentTyped } from "svelte";

export interface MyTypedef {
  [key: string]: boolean;
}

export type MyTypedefArray = MyTypedef[];

export interface TypedefsProps {
  /**
   * @default { ["1"]: true }
   */
  prop1?: MyTypedef;

  /**
   * @default []
   */
  prop2?: MyTypedefArray;
}

export default class Typedefs extends SvelteComponentTyped<
  TypedefsProps,
  Record<string, any>,
  { default: { prop1: MyTypedef; prop2: MyTypedefArray } }
> {}
