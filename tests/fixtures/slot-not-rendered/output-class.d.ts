import { SvelteComponentTyped } from "svelte";

export type SlotNotRenderedProps = {
  /**
   * The first word of an inline description is read as the slot name.
   * @default ""
   */
  title?: string;

  /** content rendered after the header. */
  Page?: (this: void) => void;

  children?: (this: void) => void;
};

export default class SlotNotRendered extends SvelteComponentTyped<
  SlotNotRenderedProps,
  Record<string, any>,
  {
    default: Record<string, never>;
    /** content rendered after the header. */
    Page: Record<string, never>;
  }
> {}
