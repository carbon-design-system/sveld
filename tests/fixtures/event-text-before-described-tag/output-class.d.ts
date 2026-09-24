import { SvelteComponentTyped } from "svelte";

/**
 * An item id.
 */
export type Item = string;

export type EventTextBeforeDescribedTagProps = {
  /**
   * @default []
   */
  items?: Item[];

  /** Renders one item. */
  item?: (this: void) => void;
};

export default class EventTextBeforeDescribedTag extends SvelteComponentTyped<
  EventTextBeforeDescribedTagProps,
  {
    /** Fired when the selection is cleared. */
    clear: CustomEvent<null>;
    /** Fired when the menu closes. */
    close: CustomEvent<null>;
    /** Fired when the menu opens. */
    open: CustomEvent<null>;
    /** Fired when an item is selected. */
    select: CustomEvent<null>;
  },
  {
    /** Renders one item. */
    item: Record<string, never>;
  }
> {}
