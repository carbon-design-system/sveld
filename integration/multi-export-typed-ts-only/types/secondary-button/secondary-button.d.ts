/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";
import { ButtonProps } from "./button/button";

export interface SecondaryButtonProps extends ButtonProps {}

export default class SecondaryButton extends SvelteComponentTyped<
  SecondaryButtonProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {
  secondary: boolean;
}
