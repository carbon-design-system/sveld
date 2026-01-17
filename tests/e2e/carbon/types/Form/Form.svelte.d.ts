import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["form"];

type $Props = {
  children?: (this: void) => void;

  [key: `data-${string}`]: any;
};

export type FormProps = Omit<$RestProps, keyof $Props> & $Props;

export default class Form extends SvelteComponentTyped<
  FormProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    submit: WindowEventMap["submit"];
  },
  { default: Record<string, never> }
> {}
