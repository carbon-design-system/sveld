import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Specify the number of tabs to render
   * @default 4
   */
  count?: number;

  [key: `data-${string}`]: any;
};

export type TabsSkeletonProps = Omit<$RestProps, keyof $Props> & $Props;

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
