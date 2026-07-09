import type { Component } from "svelte";

export type TypedSlotsProps = {
  /**
   * @default 0
   */
  prop?: number;

  /** description */
  description?: (this: void, ...args: [{ props: { class?: string } }]) => void;

  children?: (this: void, ...args: [{
        prop: number;
        doubled: number;
      }]) => void;
};

export type TypedSlotsExports = Record<string, never>;

declare const TypedSlots: Component<
  TypedSlotsProps,
  TypedSlotsExports,
  ""
>;
export default TypedSlots;
