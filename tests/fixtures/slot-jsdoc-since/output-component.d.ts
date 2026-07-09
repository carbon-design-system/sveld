import type { Component } from "svelte";

export type SlotJsdocSinceProps = {
  /**
   * Custom link content rendered in place of the default anchor.
   * @since 1.2.0
   */
  children?: (this: void, ...args: [{ props?: { class: "bx--link" } }]) => void;
};

export type SlotJsdocSinceExports = Record<string, never>;

declare const SlotJsdocSince: Component<
  SlotJsdocSinceProps,
  SlotJsdocSinceExports,
  ""
>;
export default SlotJsdocSince;
