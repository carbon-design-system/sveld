/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface HeaderNavItemProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["a"]> {
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
   * Obtain a reference to the HTML anchor element
   * @default null
   */
  ref?: null | HTMLAnchorElement;
  /** @default false */
  "sveltekit:prefetch"?: boolean;

  /** @default false */
  "sveltekit:noscroll"?: boolean;
}

export default class HeaderNavItem extends SvelteComponentTyped<
  HeaderNavItemProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    keyup: WindowEventMap["keyup"];
    keydown: WindowEventMap["keydown"];
    focus: WindowEventMap["focus"];
    blur: WindowEventMap["blur"];
  },
  {}
> {}
