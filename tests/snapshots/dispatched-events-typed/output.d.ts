/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponent<
  InputProps,
  { hover: CustomEvent<{ h1: boolean }>; destroy: CustomEvent<any> },
  { default: {} }
> {}
