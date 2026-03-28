import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Set to `true` to use the inline variant
   * @default false
   */
  inline?: boolean;

  [key: `data-${string}`]: unknown;
};

export type DropdownSkeletonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class DropdownSkeleton extends SvelteComponentTyped<
  DropdownSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  Record<string, never>
> {}
