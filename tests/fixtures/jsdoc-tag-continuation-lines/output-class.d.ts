import { SvelteComponentTyped } from "svelte";

export type Config = {
  /**
   * Height of each item in pixels, used for
   * virtualization math.
   */
  itemHeight: number;
  /**
   * Rows rendered outside the viewport,
   * above and below it.
   */
  overscan?: number;
  sticky?: boolean;
};

export type JsdocTagContinuationLinesProps = {
  /**
   * @default { itemHeight: 1 }
   */
  config?: Config;

  footer?: (this: void) => void;

  /**
   * Renders one item,
   * with its props.
   */
  item?: (this: void, ...args: [{ item: string }]) => void;
};

export default class JsdocTagContinuationLines extends SvelteComponentTyped<
  JsdocTagContinuationLinesProps,
  {
    /** Fired when the page changes. */
    change: CustomEvent<{
        /**
         * The new page, counted
         * from one.
         */
        page: number;
        pageSize: number;
      }>;
    /** Fired when a row is selected. */
    select: CustomEvent<{
        /**
         * The selected id,
         * never empty.
         */
        id: string;
        index: number;
      }>;
  },
  {
    footer: Record<string, never>;
    /**
     * Renders one item,
     * with its props.
     */
    item: { item: string };
  }
> {
  /**
   * Formats a value.
   */
  format: (value: string) => string;
}
