import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["div"];

type $Props = {
  /**
   * Specify the selected structured list row value
   * @default undefined
   */
  selected?: string;

  /**
   * Set to `true` to use the bordered variant
   * @default false
   */
  border?: boolean;

  /**
   * Set to `true` to use the selection variant
   * @default false
   */
  selection?: boolean;

  [key: `data-${string}`]: any;
};

export type StructuredListProps = Omit<$RestProps, keyof $Props> & $Props;

export default class StructuredList extends SvelteComponentTyped<
  StructuredListProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    change: CustomEvent<any>;
  },
  { default: {} }
> {}
