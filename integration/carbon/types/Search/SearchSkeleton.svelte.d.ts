/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface SearchSkeletonProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["div"]> {
  /**
   * @deprecated this prop will be removed in the next major release
   * Set to `true` to use the small variant
   * @default false
   */
  small?: boolean;

  /**
   * Specify the size of the search input
   * @default "xl"
   */
  size?: "sm" | "lg" | "xl";

  [key: `data-${string}`]: any;
}

export default class SearchSkeleton extends SvelteComponentTyped<
  SearchSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
