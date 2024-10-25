import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

export type TextAreaSkeletonProps = RestProps & {
  /**
   * Set to `true` to visually hide the label text
   * @default false
   */
  hideLabel?: boolean;

  [key: `data-${string}`]: any;
};

export default class TextAreaSkeleton extends SvelteComponentTyped<
  TextAreaSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
