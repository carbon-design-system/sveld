/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * @default () => {}
   */
  fnA?: () => {};
}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {
  /**
   * @constant
   * @default () => {}
   */
  fnB: () => {};

  /**
   * @default () => { return a + b; }
   */
  add: () => any;

  /**
   * Multiplies two numbers
   * @default () => { return a * b; }
   */
  multiply: (a: number, b: number) => number;
}
