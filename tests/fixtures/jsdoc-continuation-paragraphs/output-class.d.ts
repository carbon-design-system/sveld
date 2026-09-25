import { SvelteComponentTyped } from "svelte";

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
};

export default class JsdocContinuationParagraphs extends SvelteComponentTyped<
  JsdocContinuationParagraphsProps,
  {
    close: CustomEvent<null>;
    /**
     * Fired when the menu opens.
     *
     * Not fired on the first render.
     */
    open: CustomEvent<null>;
  },
  {
    footer: Record<string, never>;
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
    item: { item: Item };
  }
> {
  /**
   * Formats an item.
   */
  format: (item: Item) => string;
}
