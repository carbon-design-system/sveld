import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["a"];

type $Props = {
  /**
   * Set to `true` to select the current link
   * @default false
   */
  isSelected?: boolean;

  /**
   * Specify the `href` attribute
   */
  href?: string;

  /**
   * Specify the text
   */
  text?: string;

  /**
   * Specify the icon from `carbon-icons-svelte` to render
   */
  icon?: typeof import("carbon-icons-svelte").CarbonIcon;

  /**
   * Obtain a reference to the HTML anchor element
   * @default null
   */
  ref?: null | HTMLAnchorElement;

  [key: `data-${string}`]: unknown;
};

export type SideNavLinkProps = Omit<$RestProps, keyof $Props> & $Props;

export default class SideNavLink extends SvelteComponentTyped<
  SideNavLinkProps,
  { click: WindowEventMap["click"] },
  Record<string, never>
> {}
