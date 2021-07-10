/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * @default true
   */
  propBool?: boolean;

  /**
   * @default ""
   */
  propString?: string;

  name?: string;

  /**
   * @default "" + Math.random().toString(36)
   */
  id?: string;

  /**
   * @constant
   * @default { ["1"]: true }
   */
  propConst?: { ["1"]: true };
}

export default class Input extends SvelteComponentTyped<InputProps, {}, { default: {} }> {
  fn: () => any;
}
