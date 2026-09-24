import { SvelteComponentTyped } from "svelte";
import type { ButtonProps } from "./Button.svelte";

type $Props = {
  children?: (this: void) => void;
};

export type SecondaryButtonProps = Omit<ButtonProps, keyof $Props> & $Props;

export default class SecondaryButton extends SvelteComponentTyped<
  SecondaryButtonProps,
  { click: WindowEventMap["click"] },
  { default: Record<string, never> }
> {
  secondary: boolean;
}
