import { SvelteComponentTyped } from "svelte";

export type SlotJsdocOrphanTypeBeforeSlotProps = {
  /** `@type` without a preceding `@event` is ignored for events and must not become a passthrough tag. */
  row?: (this: void, ...args: [{ flag: boolean }]) => void;
};

export default class SlotJsdocOrphanTypeBeforeSlot extends SvelteComponentTyped<
  SlotJsdocOrphanTypeBeforeSlotProps,
  Record<string, any>,
  {
    /** `@type` without a preceding `@event` is ignored for events and must not become a passthrough tag. */
    row: { flag: boolean };
  }
> {}
