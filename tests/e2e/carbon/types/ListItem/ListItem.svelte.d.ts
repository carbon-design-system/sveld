import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["li"];

type $Props = {
  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type ListItemProps = Omit<$RestProps, keyof $Props> & $Props;

export default class ListItem extends SvelteComponentTyped<
  ListItemProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  { default: Record<string, never> }
> {}
