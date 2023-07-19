import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["nav"];

export interface HeaderNavProps extends RestProps {
  /**
   * Specify the ARIA label for the nav
   * @deprecated use "aria-label" instead
   * @default undefined
   */
  ariaLabel?: string;

  [key: `data-${string}`]: any;
}

export default class HeaderNav extends SvelteComponentTyped<
  HeaderNavProps,
  Record<string, any>,
  { default: {} }
> {}
