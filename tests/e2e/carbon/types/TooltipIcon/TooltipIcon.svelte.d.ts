import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * Specify the tooltip text.
   * Alternatively, use the "text" slot
   * @default ""
   */
  tooltipText?: string;

  /**
   * Set the alignment of the tooltip relative to the icon
   * @default "center"
   */
  align?: "start" | "center" | "end";

  /**
   * Set the direction of the tooltip relative to the icon
   * @default "bottom"
   */
  direction?: "top" | "right" | "bottom" | "left";

  /**
   * Set an id for the span element
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * Obtain a reference to the button HTML element
   * @default null
   */
  ref?: null | HTMLButtonElement;

  [key: `data-${string}`]: any;
};

export type TooltipIconProps = Omit<$RestProps, keyof $Props> & $Props;

export default class TooltipIcon extends SvelteComponentTyped<
  TooltipIconProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    focus: WindowEventMap["focus"];
  },
  { text: Record<string, never>; default: Record<string, never> }
> {}
