import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Specify the number of tabs to render
   * @default 4
   */
  count?: number;

  [key: `data-${string}`]: unknown;
};

export type TabsSkeletonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class TabsSkeleton extends SvelteComponentTyped<
  TabsSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  Record<string, never>
> {}
