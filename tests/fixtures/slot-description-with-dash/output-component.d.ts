import type { Component } from "svelte";

export type SlotDescriptionWithDashProps = {
  /**
   * Spread `props` onto a custom element to inherit the link class
   * and `aria-current` attribute when `isCurrentPage` is set.
   */
  children?: (this: void, ...args: [{
        props?: {
          "aria-current"?: string;
          class: "bx--link";
        }
      }]) => void;
};

export type SlotDescriptionWithDashExports = Record<string, never>;

declare const SlotDescriptionWithDash: Component<
  SlotDescriptionWithDashProps,
  SlotDescriptionWithDashExports,
  ""
>;
export default SlotDescriptionWithDash;
