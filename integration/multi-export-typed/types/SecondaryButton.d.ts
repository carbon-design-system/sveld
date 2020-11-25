/// <reference types="svelte" />
import { SvelteComponent } from "svelte";
import { ButtonProps } from "./Button";

export interface SecondaryButtonProps extends ButtonProps {}

export default class SecondaryButton extends SvelteComponent<
  SecondaryButtonProps,
  { click: WindowEventMap["click"] },
  { default: {} }
> {}
