import { SvelteComponentTyped } from "svelte";

export interface CarbonIconProps {
  /**
   * Specify an id.
   * @default undefined
   */
  id?: string;

  /**
   * Specify a class.
   * @default undefined
   */
  class?: string;

  /**
   * Set to "0" for the icon to be focusable.
   * @default undefined
   */
  tabindex?: string;

  /**
   * Set to `true` for the icon to be focusable.
   * @default false
   */
  focusable?: boolean;

  /**
   * Set a title for the icon.
   * @default undefined
   */
  title?: string;

  /**
   * Set a style for the icon.
   * @default undefined
   */
  style?: string;
}

export interface CarbonIconEvents {
  click: WindowEventMap["click"];
  mouseover: WindowEventMap["mouseover"];
  mouseenter: WindowEventMap["mouseenter"];
  mouseleave: WindowEventMap["mouseleave"];
  keyup: WindowEventMap["keyup"];
  keydown: WindowEventMap["keydown"];
}

export declare class CarbonIcon extends SvelteComponentTyped<
  CarbonIconProps,
  CarbonIconEvents,
  { default: {}; }
> {}
