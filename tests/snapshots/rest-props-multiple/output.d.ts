/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface InputProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["h1"]>,
    svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["span"]> {
  /**
   * @default false
   */
  edit?: boolean;

  /**
   * @default false
   */
  heading?: boolean;
}

export default class Input extends SvelteComponentTyped<InputProps, {}, {}> {}
