/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps {
  /**
   * Just your average CSS class string.
   * @default "test"
   */
  class?: string | null;
}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {}
