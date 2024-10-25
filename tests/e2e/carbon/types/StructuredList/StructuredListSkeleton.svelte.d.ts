import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
  /**
   * Specify the number of rows
   * @default 5
   */
  rows?: number;

  /**
   * Set to `true` to use the bordered variant
   * @default false
   */
  border?: boolean;

  [key: `data-${string}`]: any;
};

export type StructuredListSkeletonProps = Omit<
  RestProps,
  keyof $ComponentProps
> &
  $ComponentProps;

export default class StructuredListSkeleton extends SvelteComponentTyped<
  StructuredListSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
