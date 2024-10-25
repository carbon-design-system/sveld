import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["a"];

export type HeaderPanelLinkProps = RestProps & {
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

  [key: `data-${string}`]: any;
};

export default class HeaderPanelLink extends SvelteComponentTyped<
  HeaderPanelLinkProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
