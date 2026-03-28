import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
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

  [key: `data-${string}`]: unknown;
};

export type SearchSkeletonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class SearchSkeleton extends SvelteComponentTyped<
  SearchSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  Record<string, never>
> {}
