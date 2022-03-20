/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponentTyped<
  InputProps,
  {},
  { default: { a: number }; text: { a: number } }
> {}
