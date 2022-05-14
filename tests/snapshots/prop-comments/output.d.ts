/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * This is a comment.
   * @default true
   */
  prop?: boolean | string;

  /**
   * @see https://github.com/
   * @default true
   */
  prop1?: boolean;

  /**
   * This is a comment.
   * @default true
   */
  prop2?: boolean | string;
}

export default class Input extends SvelteComponentTyped<
  InputProps,
  {},
  { default: { prop: boolean | string; prop1: boolean; prop2: boolean | string } }
> {}
