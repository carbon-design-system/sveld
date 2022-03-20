/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface SideNavProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["nav"]> {
  /**
   * Set to `true` to use the fixed variant
   * @default false
   */
  fixed?: boolean;

  /**
   * Specify the ARIA label for the nav
   * @default undefined
   */
  ariaLabel?: string;

  /**
   * Set to `true` to toggle the expanded state
   * @default false
   */
  isOpen?: boolean;
}

export default class SideNav extends SvelteComponentTyped<
  SideNavProps,
  {},
  { default: {} }
> {}
