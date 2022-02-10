/// <reference types="svelte" />
import { SvelteComponentTyped } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponentTyped<
  InputProps,
  { ["custom-focus"]: CustomEvent<FocusEvent | number>; blur: FocusEvent | CustomEvent<FocusEvent> },
  {}
> {}
