import type { Component } from "svelte";

export type SlotsSpreadProps = {
  text?: (this: void) => void;

  children?: (this: void) => void;
};

export type SlotsSpreadExports = Record<string, never>;

declare const SlotsSpread: Component<
  SlotsSpreadProps,
  SlotsSpreadExports,
  ""
>;
export default SlotsSpread;
