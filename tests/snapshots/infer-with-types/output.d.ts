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
}

export default class Input extends SvelteComponentTyped<InputProps, {}, { default: {} }> {
  /**
   * @constant
   * @default { ["1"]: true }
   */
  propConst: { [key: string]: boolean };

  /**
   * @default () => { localBool = !localBool; }
   */
  fn: () => any;
}
