import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["ul"];

type $ComponentProps = {
  /**
   * Set to `true` to use the nested variant
   * @default false
   */
  nested?: boolean;

  [key: `data-${string}`]: any;
};

export type UnorderedListProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class UnorderedList extends SvelteComponentTyped<
  UnorderedListProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  { default: {} }
> {}
