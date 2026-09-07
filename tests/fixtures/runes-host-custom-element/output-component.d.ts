import type { Component } from "svelte";

export type RunesHostCustomElementProps = {
  value: any;
};

export type RunesHostCustomElementExports = Record<string, never>;

declare const RunesHostCustomElement: Component<
  RunesHostCustomElementProps,
  RunesHostCustomElementExports,
  ""
>;
export default RunesHostCustomElement;
