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

  /**
   * @default undefined
   */
  name?: undefined;

  /**
   * @default "" + Math.random().toString(36)
   */
  id?: string;
}

export default class Input extends SvelteComponentTyped<InputProps, {}, { default: {} }> {
  propConst: { ["1"]: true };

  fn: () => any;
}
