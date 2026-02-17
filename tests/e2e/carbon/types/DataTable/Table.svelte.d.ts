import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["section"];

type $Props = {
  /**
   * Set the size of the table
   * @default undefined
   */
  size?: "compact" | "short" | "tall";

  /**
   * Set to `true` to use zebra styles
   * @default false
   */
  zebra?: boolean;

  /**
   * Set to `true` to use static width
   * @default false
   */
  useStaticWidth?: boolean;

  /**
   * Set to `true` for the bordered variant
   * @default false
   */
  shouldShowBorder?: boolean;

  /**
   * Set to `true` for the sortable variant
   * @default false
   */
  sortable?: boolean;

  /**
   * Set to `true` to enable a sticky header
   * @default false
   */
  stickyHeader?: boolean;

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type TableProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Table extends SvelteComponentTyped<
  TableProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
