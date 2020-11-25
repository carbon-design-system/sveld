/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

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

  /**
   * @constant
   * @default { ["1"]: true }
   */
  propConst?: { ["1"]: true };

  /**
   * @default () => { localBool = !localBool; }
   */
  fn?: () => any;
}

export default class Input extends SvelteComponent<InputProps, {}, { default: {} }> {}
