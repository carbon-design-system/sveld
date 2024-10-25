import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["li"];

type $ComponentProps = {
  [key: `data-${string}`]: any;
};

export type ListItemProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class ListItem extends SvelteComponentTyped<
  ListItemProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  { default: {} }
> {}
