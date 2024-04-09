import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["a"];

export interface HeaderActionLinkProps extends RestProps {
  /**
   * Set to `true` to use the active state
   * @default false
   */
  linkIsActive?: boolean;

  /**
   * Specify the `href` attribute
   * @default undefined
   */
  href?: string;

  /**
   * Specify the icon from `carbon-icons-svelte` to render
   * @default undefined
   */
  icon?: typeof import("carbon-icons-svelte").CarbonIcon;

  /**
   * Obtain a reference to the HTML anchor element
   * @default null
   */
  ref?: null | HTMLAnchorElement;

  [key: `data-${string}`]: any;
}

export default class HeaderActionLink extends SvelteComponentTyped<
  HeaderActionLinkProps,
  Record<string, any>,
  {}
> {}
