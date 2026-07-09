import type { Component } from "svelte";

export type RunesBindableProps = {
  /**
   * @default 0
   */
  value?: number;
};

export type RunesBindableExports = Record<string, never>;

declare const RunesBindable: Component<
  RunesBindableProps,
  RunesBindableExports,
  "value"
>;
export default RunesBindable;
