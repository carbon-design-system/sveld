import { SvelteComponentTyped } from "svelte";

export interface MyTypedef {
  [key: string]: boolean;
}

export type MyTypedefArray = MyTypedef[];

export type TypedefsProps = {
  /**
   * @default { 1: true }
   */
  prop1?: MyTypedef;

  /**
   * @default []
   */
  prop2?: MyTypedefArray;

  children?: (this: void, ...args: [{ prop1: MyTypedef; prop2: MyTypedefArray }]) => void;
};

export default class Typedefs extends SvelteComponentTyped<
  TypedefsProps,
  Record<string, any>,
  { default: { prop1: MyTypedef; prop2: MyTypedefArray } }
> {}
