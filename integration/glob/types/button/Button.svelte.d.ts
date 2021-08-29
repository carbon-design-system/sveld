/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface ButtonProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["button"]> {
  /**
   * @default "button2"
   */
  type?: string;

  /**
   * @default false
   */
  primary?: boolean;
}

export default class Button extends SvelteComponentTyped<
  ButtonProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
