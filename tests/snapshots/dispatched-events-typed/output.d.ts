/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponentTyped<
  InputProps,
  { hover: CustomEvent<{ h1: boolean }>; destroy: CustomEvent<any> },
  { default: {} }
> {}
