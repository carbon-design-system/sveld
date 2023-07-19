import type { SvelteComponentTyped } from "svelte";
import type { ButtonProps } from "../button/button.svelte";

export interface SecondaryButtonProps extends ButtonProps {}

export default class SecondaryButton extends SvelteComponentTyped<
  SecondaryButtonProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {
  secondary: boolean;
}
