import type { SvelteComponentTyped } from "svelte";
import type { ButtonProps } from "../button/button.svelte";

export type SecondaryButtonProps = ButtonProps & {};

export default class SecondaryButton extends SvelteComponentTyped<
  SecondaryButtonProps,
  { click: WindowEventMap["click"] },
  { default: Record<string, never> }
> {
  secondary: boolean;
}
