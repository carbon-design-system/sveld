import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type $RestProps = SvelteHTMLElements["label"];

type $Props = {
  /**
   * Set to `true` to select the tile
   * @default false
   */
  selected?: boolean;

  /**
   * Set to `true` to enable the light variant
   * @default false
   */
  light?: boolean;

  /**
   * Specify the title of the selectable tile
   * @default "title"
   */
  title?: string;

  /**
   * Specify the value of the selectable tile
   * @default "value"
   */
  value?: string;

  /**
   * Specify the tabindex
   * @default "0"
   */
  tabindex?: string;

  /**
   * Specify the ARIA label for the selectable tile checkmark icon
   * @default "Tile checkmark"
   */
  iconDescription?: string;

  /**
   * Set an id for the input element
   * @default "ccs-" + Math.random().toString(36)
   */
  id?: string;

  /**
   * Specify a name attribute for the input
   * @default ""
   */
  name?: string;

  /**
   * Obtain a reference to the input HTML element
   * @default null
   */
  ref?: null | HTMLInputElement;

  [key: `data-${string}`]: any;
};

export type SelectableTileProps = Omit<$RestProps, keyof $Props> & $Props;

export default class SelectableTile extends SvelteComponentTyped<
  SelectableTileProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
    keydown: WindowEventMap["keydown"];
  },
  { default: {} }
> {}
