import type { Component } from "svelte";

export type MyContextContext = {
  /** Toggle visibility */
  toggle: () => void;
};

export type ContextSpaceProps = Record<string, never>;

export type ContextSpaceExports = Record<string, never>;

declare const ContextSpace: Component<
  ContextSpaceProps,
  ContextSpaceExports,
  ""
>;
export default ContextSpace;
