import type { Component } from "svelte";

export type SlotJsdocTwoSlotsOneBlockOrderProps = {
  /**
   * First slot only should get `@see`; `pendingTags` clears after each `@slot`.
   * @see https://example.com/docs
   */
  alpha?: (this: void, ...args: [{ n: number }]) => void;

  beta?: (this: void, ...args: [{ s: string }]) => void;
};

export type SlotJsdocTwoSlotsOneBlockOrderExports = Record<string, never>;

declare const SlotJsdocTwoSlotsOneBlockOrder: Component<
  SlotJsdocTwoSlotsOneBlockOrderProps,
  SlotJsdocTwoSlotsOneBlockOrderExports,
  ""
>;
export default SlotJsdocTwoSlotsOneBlockOrder;
