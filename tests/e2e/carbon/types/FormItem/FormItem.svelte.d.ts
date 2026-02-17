import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type FormItemProps = Omit<$RestProps, keyof $Props> & $Props;

export default class FormItem extends SvelteComponentTyped<
  FormItemProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  { default: Record<string, never> }
> {}
