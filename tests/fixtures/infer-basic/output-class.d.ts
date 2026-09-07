import { SvelteComponentTyped } from "svelte";

export type InferBasicProps = {
  /**
   * @default null
   */
  ref?: any;

  /**
   * @default true
   */
  propBool?: boolean;

  /**
   * @default ""
   */
  propString?: string;

  name: any;

  /**
   * @default "" + Math.random().toString(36)
   */
  id?: string;

  children?: (this: void) => void;
};

export default class InferBasic extends SvelteComponentTyped<
  InferBasicProps,
  Record<string, any>,
  { default: Record<string, never> }
> {
  propConst: { 1: true };

  fn: () => any;
}
