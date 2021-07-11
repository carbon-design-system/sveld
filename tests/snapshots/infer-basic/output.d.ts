/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * @default null
   */
  ref?: undefined;

  /**
   * @default true
   */
  propBool?: boolean;

  /**
   * @default ""
   */
  propString?: string;

  name?: undefined;

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
  propConst: { ["1"]: true };

  /**
   * @default () => { localBool = !localBool; }
   */
  fn: () => any;
}
