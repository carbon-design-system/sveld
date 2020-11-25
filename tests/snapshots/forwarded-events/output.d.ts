/// <reference types="svelte" />
import { SvelteComponent } from "svelte";

export interface InputProps {}

export default class Input extends SvelteComponent<
  InputProps,
  {
    click: WindowEventMap["click"];
    focus: WindowEventMap["focus"];
    blur: WindowEventMap["blur"];
    mouseover: WindowEventMap["mouseover"];
  },
  { default: {} }
> {}
