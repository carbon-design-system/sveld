import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
  /**
   * Set to `true` to hide the label text
   * @default false
   */
  hideLabel?: boolean;

  [key: `data-${string}`]: any;
};

export type SliderSkeletonProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class SliderSkeleton extends SvelteComponentTyped<
  SliderSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
