import type { Component } from "svelte";

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

  /** Fired when the selection is cleared. */
  onclear?: (event: CustomEvent<null>) => void;

  /** Fired when the menu closes. */
  onclose?: (event: CustomEvent<null>) => void;

  /** Fired when the menu opens. */
  onopen?: (event: CustomEvent<null>) => void;

  /** Fired when an item is selected. */
  onselect?: (event: CustomEvent<null>) => void;
};

export type EventTextBeforeDescribedTagExports = Record<string, never>;

declare const EventTextBeforeDescribedTag: Component<
  EventTextBeforeDescribedTagProps,
  EventTextBeforeDescribedTagExports,
  ""
>;
export default EventTextBeforeDescribedTag;
