import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * @default "button"
   */
  type?: "button" | "submit" | "reset";

  /**
   * Set to `true` to use the primary variant
   * @default false
   */
  primary?: boolean;

  [key: `data-${string}`]: any;
};

export type ButtonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
