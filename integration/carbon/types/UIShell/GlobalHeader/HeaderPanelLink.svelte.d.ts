/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface HeaderPanelLinkProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["a"]> {
  /**
   * Specify the `href` attribute
   * @default undefined
   */
  href?: string;

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

export default class HeaderPanelLink extends SvelteComponentTyped<
  HeaderPanelLinkProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
