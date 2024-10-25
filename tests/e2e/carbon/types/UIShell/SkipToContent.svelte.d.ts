import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["a"];

export type SkipToContentProps = RestProps & {
  /**
   * Specify the `href` attribute
   * @default "#main-content"
   */
  href?: string;

  /**
   * Specify the tabindex
   * @default "0"
   */
  tabindex?: string;

  [key: `data-${string}`]: any;
};

export default class SkipToContent extends SvelteComponentTyped<
  SkipToContentProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
