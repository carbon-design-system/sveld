import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
  /**
   * Specify the title of the data table
   * @default ""
   */
  title?: string;

  /**
   * Specify the description of the data table
   * @default ""
   */
  description?: string;

  /**
   * Set to `true` to enable a sticky header
   * @default false
   */
  stickyHeader?: boolean;

  [key: `data-${string}`]: any;
};

export type TableContainerProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class TableContainer extends SvelteComponentTyped<
  TableContainerProps,
  Record<string, any>,
  { default: {} }
> {}
