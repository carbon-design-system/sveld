import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Set to `true` to hide the label text
   * @default false
   */
  hideLabel?: boolean;

  [key: `data-${string}`]: unknown;
};

export type TextInputSkeletonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class TextInputSkeleton extends SvelteComponentTyped<
  TextInputSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  Record<string, never>
> {}
