/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface TooltipIconProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["button"]> {
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
}

export default class TooltipIcon extends SvelteComponentTyped<
  TooltipIconProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    focus: WindowEventMap["focus"];
  },
  { default: {}; text: {} }
> {}
