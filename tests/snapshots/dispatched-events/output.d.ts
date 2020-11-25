/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponent<
  InputProps,
  { hover: CustomEvent<any>; destroy: CustomEvent<any>; ["destroy--component"]: CustomEvent<any> },
  { default: {} }
> {}
