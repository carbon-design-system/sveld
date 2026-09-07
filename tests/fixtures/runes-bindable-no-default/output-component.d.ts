import type { Component } from "svelte";

export type RunesBindableNoDefaultProps = {
  /**
   * @default 0
   */
  value?: number;

  open?: any;

  onclick: any;
};

export type RunesBindableNoDefaultExports = Record<string, never>;

declare const RunesBindableNoDefault: Component<
  RunesBindableNoDefaultProps,
  RunesBindableNoDefaultExports,
  "value" | "open"
>;
export default RunesBindableNoDefault;
