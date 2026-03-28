import { SvelteComponentTyped } from "svelte";

export type RunesTypedPropsProps = {
  /**
   * This is a comment.
   * @see https://github.com/
   * @deprecated this prop will be removed in the next major release.
   * @default true
   */
  prop?: boolean | string;

  /**
   * This is a comment.
   * @see https://github.com/
   * @deprecated this prop will be removed in the next major release.
   * @default true
   */
  prop1?: boolean | string;

  /**
   * This is a comment.
   * @see https://github.com/
   * @deprecated this prop will be removed in the next major release.
   * @default true
   */
  prop2?: boolean | string;
};

export default class RunesTypedProps extends SvelteComponentTyped<
  RunesTypedPropsProps,
  Record<string, any>,
  Record<string, never>
> {}
