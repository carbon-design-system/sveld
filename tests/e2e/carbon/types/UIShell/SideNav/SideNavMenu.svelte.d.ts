import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["button"];

type $ComponentProps = {
  /**
   * Set to `true` to toggle the expanded state
   * @default false
   */
  expanded?: boolean;

  /**
   * Specify the text
   * @default undefined
   */
  text?: string;

  /**
   * Specify the icon from `carbon-icons-svelte` to render
   * @default undefined
   */
  icon?: typeof import("carbon-icons-svelte").CarbonIcon;

  /**
   * Obtain a reference to the HTML button element
   * @default null
   */
  ref?: null | HTMLButtonElement;

  [key: `data-${string}`]: any;
};

export type SideNavMenuProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class SideNavMenu extends SvelteComponentTyped<
  SideNavMenuProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
