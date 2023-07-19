import type { SvelteComponentTyped } from "svelte";

export interface InputProps {
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
}

export default class Input extends SvelteComponentTyped<
  InputProps,
  Record<string, any>,
  { default: { prop: boolean; prop1: boolean | string; prop2: any; prop3: boolean } }
> {}
