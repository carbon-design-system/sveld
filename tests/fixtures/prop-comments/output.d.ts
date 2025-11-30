import { SvelteComponentTyped } from "svelte";

export type PropCommentsProps = {
  /**
   * This is a comment.
   * @see https://github.com/
   * @deprecated this prop will be removed in the next major release.
   * @default true
   */
  prop?: boolean | string;

  /**
   * @see https://github.com/
   * @default true
   */
  prop1?: boolean;

  /**
   * This is a comment.
   * @default true
   */
  prop2?: boolean | string;
};

export default class PropComments extends SvelteComponentTyped<
  PropCommentsProps,
  Record<string, any>,
  { default: { prop: boolean | string; prop1: boolean; prop2: boolean | string } }
> {}
