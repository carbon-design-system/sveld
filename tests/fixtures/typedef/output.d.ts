import type { SvelteComponentTyped } from "svelte";

export interface MyTypedef {
  [key: string]: boolean;
}

export interface TypedefProps {
  /**
   * @default "id-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * @default { ["1"]: true }
   */
  prop1?: MyTypedef;
}

export default class Typedef extends SvelteComponentTyped<
  TypedefProps,
  Record<string, any>,
  { default: { prop1: MyTypedef } }
> {}
