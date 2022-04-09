/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface HeaderProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["a"]> {
  /**
   * Set to `false` to hide the side nav by default
   * @default true
   */
  expandedByDefault?: boolean;

  /**
   * Set to `true` to open the side nav
   * @default false
   */
  isSideNavOpen?: boolean;

  /**
   * Specify the ARIA label for the header
   * @default undefined
   */
  uiShellAriaLabel?: string;

  /**
   * Specify the `href` attribute
   * @default undefined
   */
  href?: string;

  /**
   * Specify the company name
   * @default undefined
   */
  company?: string;

  /**
   * Specify the platform name
   * Alternatively, use the named slot "platform" (e.g., <span slot="platform">...</span>)
   * @default ""
   */
  platformName?: string;

  /**
   * Set to `true` to persist the hamburger menu
   * @default false
   */
  persistentHamburgerMenu?: boolean;

  /**
   * Obtain a reference to the HTML anchor element
   * @default null
   */
  ref?: null | HTMLAnchorElement;

  /**
   * SvelteKit attribute to enable data prefetching
   * if a link is hovered over or touched on mobile.
   * @see https://kit.svelte.dev/docs/a-options#sveltekit-prefetch
   * @default false
   */
  "sveltekit:prefetch"?: boolean;

  /**
   * SvelteKit attribute to prevent scrolling
   * after the link is clicked.
   * @see https://kit.svelte.dev/docs/a-options#sveltekit-prefetch
   * @default false
   */
  "sveltekit:noscroll"?: boolean;
}

export default class Header extends SvelteComponentTyped<
  HeaderProps,
  { click: WindowEventMap["click"] },
  { default: {}; platform: {}; ["skip-to-content"]: {} }
> {}
