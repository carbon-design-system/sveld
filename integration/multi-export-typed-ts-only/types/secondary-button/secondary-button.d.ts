/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";
import { ButtonProps } from "./button/button";

export interface SecondaryButtonProps extends ButtonProps {
  /**
   * @constant
   * @default true
   */
  secondary?: true;
}

export default class SecondaryButton extends SvelteComponentTyped<
  SecondaryButtonProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
