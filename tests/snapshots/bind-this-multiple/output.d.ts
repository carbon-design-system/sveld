/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * @default undefined
   */
  ref?: null | HTMLButtonElement | HTMLHeadingElement;

  /**
   * @default undefined
   */
  ref2?: null | HTMLDivElement;

  /**
   * @default false
   */
  propBool?: boolean;
}

export default class Input extends SvelteComponentTyped<InputProps, {}, { default: {} }> {}
