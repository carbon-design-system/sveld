import type { SvelteComponentTyped } from "svelte";

export type InferWithTypesProps = {
  /**
   * @default true
   */
  propBool?: boolean;

  /**
   * @default ""
   */
  propString?: string;

  /**
   * @default undefined
   */
  name: string;

  /**
   * @default "" + Math.random().toString(36)
   */
  id?: string;
};

export default class InferWithTypes extends SvelteComponentTyped<
  InferWithTypesProps,
  Record<string, any>,
  { default: Record<string, never> }
> {
  propConst: { [key: string]: boolean };

  fn: () => any;
}
