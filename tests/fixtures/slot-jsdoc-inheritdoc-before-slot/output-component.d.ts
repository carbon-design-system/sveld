import type { Component } from "svelte";

export type SlotJsdocInheritdocBeforeSlotProps = {
  /**
   * Tag with an empty body still emits a lone `@inheritdoc` line above the slot.
   * @inheritdoc
   */
  content?: (this: void) => void;
};

export type SlotJsdocInheritdocBeforeSlotExports = Record<string, never>;

declare const SlotJsdocInheritdocBeforeSlot: Component<
  SlotJsdocInheritdocBeforeSlotProps,
  SlotJsdocInheritdocBeforeSlotExports,
  ""
>;
export default SlotJsdocInheritdocBeforeSlot;
