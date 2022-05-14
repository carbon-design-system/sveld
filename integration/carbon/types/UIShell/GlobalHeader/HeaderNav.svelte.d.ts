/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface HeaderNavProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["nav"]> {
  /**
   * Specify the ARIA label for the nav
   * @deprecated use "aria-label" instead
   * @default undefined
   */
  ariaLabel?: string;
}

export default class HeaderNav extends SvelteComponentTyped<
  HeaderNavProps,
  {},
  { default: {} }
> {}
