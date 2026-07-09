import { SvelteComponentTyped } from "svelte";

export type SlotJsdocTwoSlotsOneBlockOrderProps = {
  /**
   * First slot only should get `@see`; `pendingTags` clears after each `@slot`.
   * @see https://example.com/docs
   */
  alpha?: (this: void, ...args: [{ n: number }]) => void;

  beta?: (this: void, ...args: [{ s: string }]) => void;
};

export default class SlotJsdocTwoSlotsOneBlockOrder extends SvelteComponentTyped<
  SlotJsdocTwoSlotsOneBlockOrderProps,
  Record<string, any>,
  {
    /**
     * First slot only should get `@see`; `pendingTags` clears after each `@slot`.
     * @see https://example.com/docs
     */
    alpha: { n: number };
    beta: { s: string };
  }
> {}
