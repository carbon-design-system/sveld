/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * @default true
   */
  propBool?: boolean;

  /**
   * @default ""
   */
  propString?: string;

  /**
   * @default undefined
   */
  name: string;

  /**
   * @default "" + Math.random().toString(36)
   */
  id?: string;
}

export default class Input extends SvelteComponentTyped<InputProps, {}, { default: {} }> {
  propConst: { [key: string]: boolean };

  fn: () => any;
}
