import type { SvelteComponentTyped } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponentTyped<
  InputProps,
  {
    /** Fired on mouseover. */ hover: CustomEvent<{ h1: boolean }>;
    destroy: CustomEvent<null>;
  },
  { default: {} }
> {}
