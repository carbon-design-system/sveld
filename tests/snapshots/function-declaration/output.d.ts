/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * @default () => {}
   */
  fnA?: () => {};
}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {
  fnB: () => {};

  add: () => any;

  /**
   * Multiplies two numbers
   */
  multiply: (a: number, b: number) => number;
}
