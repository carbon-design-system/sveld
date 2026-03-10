import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["button"];

type $Props = {
  /**
   * Button type attribute
   * @default "button"
   */
  type?: string;

  /**
   * Set to `true` to use the primary variant
   * @default false
   */
  primary?: boolean;

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type ButtonProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  { default: Record<string, never> }
> {}
