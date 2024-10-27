import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

export interface HeaderActionSlideTransition {
  delay?: number;
  duration?: number;
  easing?: (t: number) => number;
}

type RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * Set to `true` to open the panel
   * @default false
   */
  isOpen?: boolean;

  /**
   * Specify the icon from `carbon-icons-svelte` to render
   * @default undefined
   */
  icon?: typeof import("carbon-icons-svelte").CarbonIcon;

  /**
   * Specify the text
   * Alternatively, use the named slot "text" (e.g., <div slot="text">...</div>)
   * @default undefined
   */
  text?: string;

  /**
   * Obtain a reference to the button HTML element
   * @default null
   */
  ref?: null | HTMLButtonElement;

  /**
   * Customize the panel transition (i.e., `transition:slide`)
   * Set to `false` to disable the transition
   * @default { duration: 200 }
   */
  transition?: false | HeaderActionSlideTransition;

  [key: `data-${string}`]: any;
};

export type HeaderActionProps = Omit<RestProps, keyof $Props> & $Props;

export default class HeaderAction extends SvelteComponentTyped<
  HeaderActionProps,
  { click: WindowEventMap["click"]; close: CustomEvent<null> },
  { default: {}; text: {} }
> {}
