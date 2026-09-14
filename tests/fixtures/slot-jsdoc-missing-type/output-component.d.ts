import type { Component } from "svelte";

export type SlotJsdocMissingTypeProps = {
  /**
   * @default ""
   */
  title?: string;

  named?: (this: void) => void;
};

export type SlotJsdocMissingTypeExports = Record<string, never>;

declare const SlotJsdocMissingType: Component<
  SlotJsdocMissingTypeProps,
  SlotJsdocMissingTypeExports,
  ""
>;
export default SlotJsdocMissingType;
