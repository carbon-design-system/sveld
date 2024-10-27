import type { SvelteComponentTyped } from "svelte";

export type InferBasicProps = {
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

  /**
   * @default undefined
   */
  name: undefined;

  /**
   * @default "" + Math.random().toString(36)
   */
  id?: string;
};

export default class InferBasic extends SvelteComponentTyped<InferBasicProps, Record<string, any>, { default: {} }> {
  propConst: { ["1"]: true };

  fn: () => any;
}
