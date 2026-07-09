import { SvelteComponentTyped } from "svelte";

export type RunesTypedPropsProps = {
  /**
   * @default true
   */
  prop?: boolean;

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

export default class RunesTypedProps extends SvelteComponentTyped<
  RunesTypedPropsProps,
  Record<string, any>,
  Record<string, never>
> {}
