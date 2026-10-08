import type { Component } from "svelte";

export type SlotDefaultDashDescriptionProps = {
  /**
   * @default ""
   */
  title?: string;

  /** Custom heading. */
  heading?: (this: void, ...args: [{ title: string }]) => void;

  /** Page content rendered after the header. */
  children?: (this: void) => void;
};

export type SlotDefaultDashDescriptionExports = Record<string, never>;

declare const SlotDefaultDashDescription: Component<
  SlotDefaultDashDescriptionProps,
  SlotDefaultDashDescriptionExports,
  ""
>;
export default SlotDefaultDashDescription;
