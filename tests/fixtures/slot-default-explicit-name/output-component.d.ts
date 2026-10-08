import type { Component } from "svelte";

export type SlotDefaultExplicitNameProps = {
  /**
   * @default 0
   */
  count?: number;

  /** Page content rendered after the header. */
  children?: (this: void, ...args: [{ count: number }]) => void;
};

export type SlotDefaultExplicitNameExports = Record<string, never>;

declare const SlotDefaultExplicitName: Component<
  SlotDefaultExplicitNameProps,
  SlotDefaultExplicitNameExports,
  ""
>;
export default SlotDefaultExplicitName;
