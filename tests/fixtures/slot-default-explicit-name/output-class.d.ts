import { SvelteComponentTyped } from "svelte";

export type SlotDefaultExplicitNameProps = {
  /**
   * @default 0
   */
  count?: number;

  /** Page content rendered after the header. */
  children?: (this: void, ...args: [{ count: number }]) => void;
};

export default class SlotDefaultExplicitName extends SvelteComponentTyped<
  SlotDefaultExplicitNameProps,
  Record<string, any>,
  {
    /** Page content rendered after the header. */
    default: { count: number };
  }
> {}
