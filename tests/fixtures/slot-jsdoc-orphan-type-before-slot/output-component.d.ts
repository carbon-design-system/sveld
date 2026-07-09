import type { Component } from "svelte";

export type SlotJsdocOrphanTypeBeforeSlotProps = {
  /** `@type` without a preceding `@event` is ignored for events and must not become a passthrough tag. */
  row?: (this: void, ...args: [{ flag: boolean }]) => void;
};

export type SlotJsdocOrphanTypeBeforeSlotExports = Record<string, never>;

declare const SlotJsdocOrphanTypeBeforeSlot: Component<
  SlotJsdocOrphanTypeBeforeSlotProps,
  SlotJsdocOrphanTypeBeforeSlotExports,
  ""
>;
export default SlotJsdocOrphanTypeBeforeSlot;
