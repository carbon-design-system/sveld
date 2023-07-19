import type { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * @default () => {}
   */
  fnA?: () => {};
}

export default class Input extends SvelteComponentTyped<InputProps, Record<string, any>, {}> {
  fnB: () => {};

  add: () => any;

  /**
   * Multiplies two numbers
   */
  multiply: (a: number, b: number) => number;
}
