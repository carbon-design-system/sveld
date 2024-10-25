import type { SvelteComponentTyped } from "svelte";
import type { ButtonProps } from "./Button.svelte";

export type SecondaryButtonProps = ButtonProps & {};

export default class SecondaryButton extends SvelteComponentTyped<
  SecondaryButtonProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {
  secondary: boolean;
}
