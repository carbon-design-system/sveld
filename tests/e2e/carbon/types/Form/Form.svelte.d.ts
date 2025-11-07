import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["form"];

type $Props = {
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
