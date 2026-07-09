import { SvelteComponentTyped } from "svelte";

export type SlotJsdocSinceProps = {
  /**
   * Custom link content rendered in place of the default anchor.
   * @since 1.2.0
   */
  children?: (this: void, ...args: [{ props?: { class: "bx--link" } }]) => void;
};

export default class SlotJsdocSince extends SvelteComponentTyped<
  SlotJsdocSinceProps,
  Record<string, any>,
  {
    /**
     * Custom link content rendered in place of the default anchor.
     * @since 1.2.0
     */
    default: { props?: { class: "bx--link" } };
  }
> {}
