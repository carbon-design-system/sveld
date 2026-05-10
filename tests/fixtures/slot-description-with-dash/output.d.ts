import { SvelteComponentTyped } from "svelte";

export type SlotDescriptionWithDashProps = {
  /**
   * Spread `props` onto a custom element to inherit the link class
   * and `aria-current` attribute when `isCurrentPage` is set.
   */
  children?: (this: void, ...args: [{ props?: { "aria-current"?: string; class: "bx--link" } }]) => void;
};

export default class SlotDescriptionWithDash extends SvelteComponentTyped<
  SlotDescriptionWithDashProps,
  Record<string, any>,
  {
    /**
     * Spread `props` onto a custom element to inherit the link class
     * and `aria-current` attribute when `isCurrentPage` is set.
     */
    default: { props?: { "aria-current"?: string; class: "bx--link" } };
  }
> {}
