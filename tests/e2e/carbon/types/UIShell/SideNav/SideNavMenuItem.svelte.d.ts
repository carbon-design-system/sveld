import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["a"];

type $Props = {
  /**
   * Set to `true` to select the item
   */
  isSelected?: boolean;

  /**
   * Specify the `href` attribute
   */
  href?: string;

  /**
   * Specify the item text
   */
  text?: string;

  /**
   * Obtain a reference to the HTML anchor element
   * @default null
   */
  ref?: null | HTMLAnchorElement;

  [key: `data-${string}`]: unknown;
};

export type SideNavMenuItemProps = Omit<$RestProps, keyof $Props> & $Props;

export default class SideNavMenuItem extends SvelteComponentTyped<
  SideNavMenuItemProps,
  { click: WindowEventMap["click"] },
  Record<string, never>
> {}
