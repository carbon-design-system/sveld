import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

export type NumberInputSkeletonProps = RestProps & {
  /**
   * Set to `true` to hide the label text
   * @default false
   */
  hideLabel?: boolean;

  [key: `data-${string}`]: any;
};

export default class NumberInputSkeleton extends SvelteComponentTyped<
  NumberInputSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
