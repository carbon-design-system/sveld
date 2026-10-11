import type { Component } from "svelte";

export type SlotsSpreadProps = {
  text?: (this: void, ...args: [{ a: 4 }]) => void;

  children?: (this: void, ...args: [{ a: 4 }]) => void;
};

export type SlotsSpreadExports = Record<string, never>;

declare const SlotsSpread: Component<
  SlotsSpreadProps,
  SlotsSpreadExports,
  ""
>;
export default SlotsSpread;
