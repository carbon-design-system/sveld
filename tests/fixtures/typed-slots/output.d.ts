import type { SvelteComponentTyped } from "svelte";

export interface TypedSlotsProps {
  /**
   * @default 0
   */
  prop?: number;
}

export default class TypedSlots extends SvelteComponentTyped<
  TypedSlotsProps,
  Record<string, any>,
  {
    default: { prop: number; doubled: number };
    /** description */
    description: { props: { class?: string } };
  }
> {}
