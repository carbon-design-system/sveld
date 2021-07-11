/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";
import { ButtonProps } from "./Button";

export interface SecondaryButtonProps extends ButtonProps {}

export default class SecondaryButton extends SvelteComponentTyped<
  SecondaryButtonProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {
  /**
   * @constant
   * @default true
   */
  secondary: boolean;
}
