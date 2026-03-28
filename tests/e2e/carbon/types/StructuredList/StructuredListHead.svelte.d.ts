import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type StructuredListHeadProps = Omit<$RestProps, keyof $Props> & $Props;

export default class StructuredListHead extends SvelteComponentTyped<
  StructuredListHeadProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  { default: Record<string, never> }
> {}
