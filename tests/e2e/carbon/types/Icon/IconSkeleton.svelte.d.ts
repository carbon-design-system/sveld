import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Set the size of the icon
   * @default 16
   */
  size?: number;

  [key: `data-${string}`]: any;
};

export type IconSkeletonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class IconSkeleton extends SvelteComponentTyped<
  IconSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
