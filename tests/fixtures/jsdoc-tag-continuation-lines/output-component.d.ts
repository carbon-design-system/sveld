import type { Component } from "svelte";

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

  /** Fired when the page changes. */
  onchange?: (event: CustomEvent<{
        /**
         * The new page, counted
         * from one.
         */
        page: number;
        pageSize: number;
      }>) => void;

  /** Fired when a row is selected. */
  onselect?: (event: CustomEvent<{
        /**
         * The selected id,
         * never empty.
         */
        id: string;
        index: number;
      }>) => void;
};

export type JsdocTagContinuationLinesExports = {
  /**
   * Formats a value.
   */
  format: (value: string) => string;
};

declare const JsdocTagContinuationLines: Component<
  JsdocTagContinuationLinesProps,
  JsdocTagContinuationLinesExports,
  ""
>;
export default JsdocTagContinuationLines;
