import { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["ul"];

type $Props = {
  /**
   * Set to `true` to use the nested variant
   * @default false
   */
  nested?: boolean;

  children?: (this: void) => void;

  [key: `data-${string}`]: unknown;
};

export type UnorderedListProps = Omit<$RestProps, keyof $Props> & $Props;

export default class UnorderedList extends SvelteComponentTyped<
  UnorderedListProps,
  {
    click: WindowEventMap["click"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    mouseover: WindowEventMap["mouseover"];
  },
  { default: Record<string, never> }
> {}
