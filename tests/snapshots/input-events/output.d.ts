/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponentTyped<
  InputProps,
  {
    input: WindowEventMap["input"];
    change: WindowEventMap["change"];
    paste: DocumentAndElementEventHandlersEventMap["paste"];
  },
  {}
> {}
