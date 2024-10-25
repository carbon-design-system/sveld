import type { SvelteComponentTyped } from "svelte";
import type { SvelteHTMLElements } from "svelte/elements";

type RestProps = SvelteHTMLElements["div"];

type $ComponentProps = {
  /**
   * Set to `true` to enable the light variant
   * @default false
   */
  light?: boolean;

  [key: `data-${string}`]: any;
};

export type TileProps = Omit<RestProps, keyof $ComponentProps> &
  $ComponentProps;

export default class Tile extends SvelteComponentTyped<
  TileProps,
  {
    click: WindowEventMap["click"];
    mouseover: WindowEventMap["mouseover"];
    mouseenter: WindowEventMap["mouseenter"];
    mouseleave: WindowEventMap["mouseleave"];
  },
  { default: {} }
> {}
