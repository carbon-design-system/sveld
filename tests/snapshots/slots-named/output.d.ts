/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface InputProps {
  /**
   * @default ""
   */
  text?: string;
}

export default class Input extends SvelteComponent<InputProps, {}, { default: {}; text: { text: string } }> {}
