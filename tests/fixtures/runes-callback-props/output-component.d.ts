import type { Component } from "svelte";

export type RunesCallbackPropsProps = {
  /**
   * @default undefined
   */
  onclick: undefined;
};

export type RunesCallbackPropsExports = Record<string, never>;

declare const RunesCallbackProps: Component<
  RunesCallbackPropsProps,
  RunesCallbackPropsExports,
  ""
>;
export default RunesCallbackProps;
