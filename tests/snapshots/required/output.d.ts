/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * @required
   * @default true
   */
  prop: boolean;

  /**
   * This is a comment.
   * @required
   * @default true
   */
  prop1: boolean | string;
}

export default class Input extends SvelteComponentTyped<
  InputProps,
  {},
  { default: { prop: boolean; prop1: boolean | string } }
> {}
