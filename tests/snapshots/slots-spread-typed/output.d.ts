import type { SvelteComponentTyped } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponentTyped<
  InputProps,
  Record<string, any>,
  { default: { a: number }; text: { a: number } }
> {}
