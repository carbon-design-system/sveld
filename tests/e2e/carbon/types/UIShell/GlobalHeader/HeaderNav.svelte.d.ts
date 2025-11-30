import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["nav"];

type $Props = {
  /**
   * Specify the ARIA label for the nav
   * @deprecated use "aria-label" instead
   * @default undefined
   */
  ariaLabel?: string;

  [key: `data-${string}`]: any;
};

export type HeaderNavProps = Omit<$RestProps, keyof $Props> & $Props;

export default class HeaderNav extends SvelteComponentTyped<
  HeaderNavProps,
  Record<string, any>,
  { default: Record<string, never> }
> {}
