import type { Component } from "svelte";

export type SlotsSpreadTypedProps = {
  /**
   * @default ""
   */
  iconStyle?: string;

  icon?: (this: void, ...args: [{ style: string }]) => void;

  text?: (this: void, ...args: [{ a: number }]) => void;

  children?: (this: void, ...args: [{ a: number }]) => void;
};

export type SlotsSpreadTypedExports = Record<string, never>;

declare const SlotsSpreadTyped: Component<
  SlotsSpreadTypedProps,
  SlotsSpreadTypedExports,
  ""
>;
export default SlotsSpreadTyped;
