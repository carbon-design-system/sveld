/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface TabsSkeletonProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["div"]> {
  /**
   * Specify the number of tabs to render
   * @default 4
   */
  count?: number;

  [key: `data-${string}`]: any;
}

export default class TabsSkeleton extends SvelteComponentTyped<
  TabsSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
