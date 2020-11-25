/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface InputProps {
  ref?: null | HTMLButtonElement;
}

export default class Input extends SvelteComponent<InputProps, {}, { default: {} }> {}
