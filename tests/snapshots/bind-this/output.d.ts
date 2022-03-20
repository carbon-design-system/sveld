/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * @default undefined
   */
  ref?: null | HTMLButtonElement;
}

export default class Input extends SvelteComponentTyped<InputProps, {}, { default: {} }> {}
