import type { Component } from "svelte";

export type RunesHostCustomElementProps = {
  /**
   * @default undefined
   */
  value: undefined;
};

export type RunesHostCustomElementExports = Record<string, never>;

declare const RunesHostCustomElement: Component<
  RunesHostCustomElementProps,
  RunesHostCustomElementExports,
  ""
>;
export default RunesHostCustomElement;
