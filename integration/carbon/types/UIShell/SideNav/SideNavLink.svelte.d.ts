/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface SideNavLinkProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["a"]> {
  /**
   * Set to `true` to select the current link
   * @default false
   */
  isSelected?: boolean;

  /**
   * Specify the `href` attribute
   * @default undefined
   */
  href?: string;

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
   * Obtain a reference to the HTML anchor element
   * @default null
   */
  ref?: null | HTMLAnchorElement;
}

export default class SideNavLink extends SvelteComponentTyped<
  SideNavLinkProps,
  { click: WindowEventMap["click"] },
  {}
> {}
