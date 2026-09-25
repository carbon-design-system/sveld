import type { Component } from "svelte";

export type Item = {
  /**
   * The item id.
   *
   * Unique within one menu.
   */
  id: string;
};

export type Count = number;

/**
 * The menu's placement.
 *
 * Flips when there's no room.
 */
export type Placement = "top" | "bottom";

export type JsdocContinuationParagraphsProps = {
  /**
   * @default []
   */
  items?: Item[];

  footer?: (this: void) => void;

  /**
   * Renders one item.
   *
   * For example:
   * ```svelte
   * {#if item.id}
   *   <b>{item.id}</b>
   * {/if}
   * ```
   */
  item?: (this: void, ...args: [{ item: Item }]) => void;

  onclose?: (event: CustomEvent<null>) => void;

  /**
   * Fired when the menu opens.
   *
   * Not fired on the first render.
   */
  onopen?: (event: CustomEvent<null>) => void;
};

export type JsdocContinuationParagraphsExports = {
  /**
   * Formats an item.
   */
  format: (item: Item) => string;
};

declare const JsdocContinuationParagraphs: Component<
  JsdocContinuationParagraphsProps,
  JsdocContinuationParagraphsExports,
  ""
>;
export default JsdocContinuationParagraphs;
