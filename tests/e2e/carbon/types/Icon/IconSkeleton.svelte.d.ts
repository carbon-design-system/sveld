import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

export interface IconSkeletonProps extends RestProps {
  /**
   * Set the size of the icon
   * @default 16
   */
  size?: number;

  [key: `data-${string}`]: any;
}

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
