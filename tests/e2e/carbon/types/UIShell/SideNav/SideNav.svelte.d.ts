import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["nav"];

type $Props = {
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

  [key: `data-${string}`]: any;
};

export type SideNavProps = Omit<$RestProps, keyof $Props> & $Props;

export default class SideNav extends SvelteComponentTyped<
  SideNavProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
