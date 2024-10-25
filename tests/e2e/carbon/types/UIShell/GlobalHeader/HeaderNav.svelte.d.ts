import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["nav"];

type $ComponentProps = {
  /**
   * Specify the ARIA label for the nav
   * @deprecated use "aria-label" instead
   * @default undefined
   */
  ariaLabel?: string;

  [key: `data-${string}`]: any;
};

export type HeaderNavProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class HeaderNav extends SvelteComponentTyped<
  HeaderNavProps,
  Record<string, any>,
  { default: {} }
> {}
