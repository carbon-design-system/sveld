/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["a"]> {
  /** @default false */
  "sveltekit:prefetch"?: boolean;

  /** @default false */
  "sveltekit:noscroll"?: boolean;
}

export default class Input extends SvelteComponentTyped<InputProps, {}, { default: {} }> {}
