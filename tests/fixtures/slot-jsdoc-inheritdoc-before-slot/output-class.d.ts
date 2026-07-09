import { SvelteComponentTyped } from "svelte";

export type SlotJsdocInheritdocBeforeSlotProps = {
  /**
   * Tag with an empty body still emits a lone `@inheritdoc` line above the slot.
   * @inheritdoc
   */
  content?: (this: void) => void;
};

export default class SlotJsdocInheritdocBeforeSlot extends SvelteComponentTyped<
  SlotJsdocInheritdocBeforeSlotProps,
  Record<string, any>,
  {
    /**
     * Tag with an empty body still emits a lone `@inheritdoc` line above the slot.
     * @inheritdoc
     */
    content: Record<string, never>;
  }
> {}
