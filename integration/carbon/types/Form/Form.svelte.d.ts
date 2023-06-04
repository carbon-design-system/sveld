/// <reference types="svelte" />
import type { SvelteComponentTyped } from "svelte";

export interface FormProps
  extends svelte.JSX.HTMLAttributes<HTMLElementTagNameMap["form"]> {
  [key: `data-${string}`]: any;
}

export default class Form extends SvelteComponentTyped<
  FormProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    submit: WindowEventMap["submit"];
  },
  { default: {} }
> {}
