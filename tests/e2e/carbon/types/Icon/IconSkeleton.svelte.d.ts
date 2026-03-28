import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Set the size of the icon
   * @default 16
   */
  size?: number;

  [key: `data-${string}`]: unknown;
};

export type IconSkeletonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class IconSkeleton extends SvelteComponentTyped<
  IconSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  Record<string, never>
> {}
