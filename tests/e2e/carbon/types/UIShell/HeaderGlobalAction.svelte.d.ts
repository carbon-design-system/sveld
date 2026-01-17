import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * Set to `true` to use the active variant
   * @default false
   */
  isActive?: boolean;

  /**
   * Specify the icon to render
   * @default undefined
   */
  icon?: typeof import("carbon-icons-svelte").CarbonIcon;

  /**
   * Obtain a reference to the HTML button element
   * @default null
   */
  ref?: null | HTMLButtonElement;

  children?: (this: void) => void;

  [key: `data-${string}`]: any;
};

export type HeaderGlobalActionProps = Omit<$RestProps, keyof $Props> & $Props;

export default class HeaderGlobalAction extends SvelteComponentTyped<
  HeaderGlobalActionProps,
  { click: WindowEventMap["click"] },
  { default: Record<string, never> }
> {}
