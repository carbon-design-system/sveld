import type { Component } from "svelte";

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

export type RunesTypedPropsExports = Record<string, never>;

declare const RunesTypedProps: Component<
  RunesTypedPropsProps,
  RunesTypedPropsExports,
  ""
>;
export default RunesTypedProps;
