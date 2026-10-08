import type { Component } from "svelte";

export type SlotNotRenderedProps = {
  /**
   * The first word of an inline description is read as the slot name.
   * @default ""
   */
  title?: string;

  /** content rendered after the header. */
  Page?: (this: void) => void;

  children?: (this: void) => void;
};

export type SlotNotRenderedExports = Record<string, never>;

declare const SlotNotRendered: Component<
  SlotNotRenderedProps,
  SlotNotRenderedExports,
  ""
>;
export default SlotNotRendered;
