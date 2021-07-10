/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * @default () => {}
   */
  fnA?: () => {};

  /**
   * @constant
   * @default () => {}
   */
  fnB?: () => {};
}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {
  add: () => any;

  /**
   * Multiplies two numbers
   */
  multiply: (a: number, b: number) => number;
}
