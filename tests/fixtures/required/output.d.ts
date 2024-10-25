import type { SvelteComponentTyped } from "svelte";

export type RequiredProps = {
  /**
   * @required
   * @default true
   */
  prop?: boolean;

  /**
   * This is a comment.
   * @required
   * @default true
   */
  prop1?: boolean | string;

  /**
   * @default undefined
   */
  prop2: undefined;

  /**
   * @default undefined
   */
  prop3: boolean;
};

export default class Required extends SvelteComponentTyped<
  RequiredProps,
  Record<string, any>,
  { default: { prop: boolean; prop1: boolean | string; prop2: any; prop3: boolean } }
> {}
