import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Specify the toggle size
   * @default "default"
   */
  size?: "default" | "sm";

  /**
   * Specify the label text
   * @default ""
   */
  labelText?: string;

  /**
   * Set an id for the input element
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  [key: `data-${string}`]: any;
};

export type ToggleSkeletonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class ToggleSkeleton extends SvelteComponentTyped<
  ToggleSkeletonProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  {}
> {}
