/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface InputProps {
  ref?: null | HTMLButtonElement | HTMLHeadingElement;

  ref2?: null | HTMLDivElement;

  /**
   * @default false
   */
  propBool?: boolean;
}

export default class Input extends SvelteComponent<InputProps, {}, { default: {} }> {}
